// The PET scanner: decays → positron range → annihilation → photon transport → detector ring
// → energy window → coincidence sorting (trues, scatters, randoms, multiples).
// No DOM here: the UI changes `config` and calls acquire().
import {rng, gaussian, exponential} from './random.js';
import {PositronTransport} from './positron.js';
import {annihilate, ME_KEV} from './annihilation.js';
import {transportPhoton, C_CM_PER_NS} from './photon.js';

export const DEFAULTS = {
  isotope: 'F-18',
  positronRange: true,
  nonCollinearity: true,
  attenuation: true,
  scatter: true,
  activity: 5e6,            // decays per second in the slice
  efficiency: 0.8,          // probability a photon reaching the ring is detected
  energyResolution: 0.12,   // FWHM fraction at 511 keV
  windowLow: 425, windowHigh: 650, // keV
  coincidenceWindow: 4,     // ns
  timingResolution: 400,    // coincidence timing resolution (CTR), ps FWHM
  ringRadius: 40,           // cm
  crystals: 256,
  fovRadius: 14             // cm: LORs that miss this circle are discarded
};

export class Scanner {
  constructor(phantom, config = {}, seed = 2026) {
    this.config = {...DEFAULTS, ...config};
    this.rand = rng(seed);
    this.positron = new PositronTransport(rng(seed + 1));
    this.positron.setIsotope(this.config.isotope);
    this.phantom = phantom;
    this.onCoincidence = null;
    this.reset();
  }

  setIsotope(key) {this.config.isotope = key; this.positron.setIsotope(key);}
  setPhantom(p) {this.phantom = p; this.reset();}

  reset() {
    this.time = 0;                 // ns of simulated acquisition
    this.pending = [];             // detected singles waiting for the coincidence sorter
    this.counts = {decays: 0, photonsDetected: 0, singles: 0, prompts: 0, trues: 0, scatters: 0, randoms: 0, multiples: 0, outsideFov: 0};
    this.spectrum = new Float64Array(140);       // detected single energies, 5 keV bins 0–700 keV
    this.recent = [];                            // recent coincidences for display
    this.events = [];                            // list-mode record (for CSV)
    this.maxEvents = 200000;
    this.crystalHits = new Float32Array(this.config.crystals);
    this.lastAnnihilation = null;
  }

  crystalCenter(i) {
    const a = (i + 0.5) * 2 * Math.PI / this.config.crystals, R = this.config.ringRadius;
    return [R * Math.cos(a), R * Math.sin(a)];
  }

  // Simulate one decay. If `record` is true, also return full geometry for animation.
  decay(t, id, record = false) {
    const cfg = this.config, rand = this.rand;
    const emission = this.phantom.sampleEmission(rand);
    if (!emission) return null;
    let [x, y] = emission, track = null;
    if (cfg.positronRange) {
      // Range scales inversely with the density of the material the positron travels in.
      const scale = 0.1 / Math.max(this.phantom.densityAt(x, y), 0.05); // mm → cm, density-scaled
      if (record) {
        const run = this.positron.run(true);
        track = run.path.map(([px, py]) => [px * scale * 10, py * scale * 10]); // keep mm for inset
        x += run.displacement[0] * scale; y += run.displacement[1] * scale;
      } else {
        const [dx, dy] = this.positron.sample();
        x += dx * scale; y += dy * scale;
      }
    }
    const ann = annihilate(rand, {nonCollinearity: cfg.nonCollinearity});
    this.lastAnnihilation = ann;
    const singles = [], photons = [];
    for (const ph of ann.photons) {
      const res = transportPhoton(rand, this.phantom, x, y, ph.dir[0], ph.dir[1], ph.E, cfg.ringRadius,
        {attenuation: cfg.attenuation, scatter: cfg.scatter, record});
      const info = {...res, detected: false, inWindow: false, measuredE: 0, crystal: -1};
      photons.push(info);
      if (res.absorbed || rand() > cfg.efficiency) continue;
      const sigmaE = cfg.energyResolution / 2.355 * Math.sqrt(ME_KEV * res.E);
      const measured = res.E + sigmaE * gaussian(rand);
      const bin = Math.floor(measured / 5);
      if (bin >= 0 && bin < this.spectrum.length) this.spectrum[bin]++;
      this.counts.photonsDetected++;
      let a = res.angle; if (a < 0) a += 2 * Math.PI;
      const crystal = Math.min(cfg.crystals - 1, Math.floor(a / (2 * Math.PI) * cfg.crystals));
      this.crystalHits[crystal] += 1;
      Object.assign(info, {detected: true, measuredE: measured, crystal});
      if (measured < cfg.windowLow || measured > cfg.windowHigh) continue;
      info.inWindow = true;
      // Each detector time-stamps with jitter; two of them combine to the CTR.
      const sigmaT = cfg.timingResolution / 1000 / 2.355 / Math.SQRT2;
      singles.push({t: t + res.length / C_CM_PER_NS + sigmaT * gaussian(rand), crystal, E: measured,
        decay: id, scattered: res.scatters > 0, ax: x, ay: y});
    }
    return {singles, emission, annihilation: [x, y], ann, photons, track};
  }

  // Acquire n decays. Returns the first decay's full geometry if recordFirst is set.
  acquire(n, {recordFirst = false, flush = false} = {}) {
    const cfg = this.config, meanGap = 1e9 / cfg.activity;
    let featured = null;
    for (let k = 0; k < n; k++) {
      this.time += exponential(this.rand, 1 / meanGap);
      const id = this.counts.decays++;
      const d = this.decay(this.time, id, recordFirst && k === 0);
      if (!d) continue;
      if (recordFirst && k === 0) featured = d;
      for (const s of d.singles) this.pending.push(s);
      this.counts.singles += d.singles.length;
    }
    // Every single from decays before `safe` has already arrived, so the sorter can close them.
    const maxFlight = 2 * cfg.ringRadius / C_CM_PER_NS + 5 * cfg.timingResolution / 1000;
    this.sort(flush ? Infinity : this.time - maxFlight - cfg.coincidenceWindow);
    return featured;
  }

  // Single-window coincidence sorter: a window opens on each unpaired single; exactly two
  // singles in the window form a prompt coincidence, more than two are discarded as multiples.
  sort(safeTime) {
    const cfg = this.config, tau = cfg.coincidenceWindow, P = this.pending;
    P.sort((a, b) => a.t - b.t);
    let i = 0;
    while (i < P.length && P[i].t + tau < safeTime) {
      let j = i + 1;
      while (j < P.length && P[j].t - P[i].t <= tau) j++;
      const inWindow = j - i;
      if (inWindow === 2) this.record(P[i], P[i + 1]);
      else if (inWindow > 2) this.counts.multiples++;
      i = j;
    }
    this.pending = P.slice(i);
  }

  record(a, b) {
    const cfg = this.config;
    if (a.crystal === b.crystal) return;
    const [x1, y1] = this.crystalCenter(a.crystal), [x2, y2] = this.crystalCenter(b.crystal);
    const L = Math.hypot(x2 - x1, y2 - y1), s = Math.abs((x1 * y2 - x2 * y1) / L);
    if (s > cfg.fovRadius) {this.counts.outsideFov++; return;}
    const type = a.decay !== b.decay ? 'random' : (a.scattered || b.scattered ? 'scatter' : 'true');
    this.counts.prompts++;
    this.counts[type === 'true' ? 'trues' : type === 'scatter' ? 'scatters' : 'randoms']++;
    // a arrived first (sorted), so the annihilation is closer to crystal a by c·Δt/2.
    const ev = {t: a.t, c1: a.crystal, c2: b.crystal, x1, y1, x2, y2, dt: b.t - a.t, E1: a.E, E2: b.E, type,
      ax: type === 'random' ? null : a.ax, ay: type === 'random' ? null : a.ay};
    this.recent.push(ev); if (this.recent.length > 160) this.recent.shift();
    if (this.events.length < this.maxEvents) this.events.push(ev);
    this.onCoincidence?.(ev);
  }

  stats() {
    const c = this.counts, seconds = this.time * 1e-9 || 1e-12;
    const T = c.trues, S = c.scatters, R = c.randoms;
    return {
      ...c, seconds,
      scatterFraction: T + S > 0 ? S / (T + S) : 0,
      randomFraction: c.prompts > 0 ? R / c.prompts : 0,
      // Noise-equivalent count rate: the image-quality figure of merit for PET.
      necr: T + S + R > 0 ? (T * T / (T + S + R)) / seconds : 0,
      promptRate: c.prompts / seconds
    };
  }
}
