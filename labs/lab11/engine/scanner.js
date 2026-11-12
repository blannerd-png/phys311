// The PET scanner in 3D: decays → positron range → annihilation → photon transport → detector
// (a stack of rings) → energy window → coincidence sorting (trues, scatters, randoms, multiples).
//
// The detector is deliberately simple (Prof. Breinig: "model them as detectors with a given time
// resolution and detection efficiency"): a photon that reaches a crystal is detected with
// probability `efficiency`, and each detection gets a time stamp with Gaussian jitter so that
// the difference of two stamps has the coincidence timing resolution `timingResolution` (FWHM).
// No DOM here: the UI changes `config` and calls acquire().
import {rng, gaussian, exponential} from './random.js';
import {PositronTransport} from './positron.js';
import {annihilate, isotropic, ME_KEV} from './annihilation.js';
import {transportPhoton, straightHitZ, C_CM_PER_NS} from './photon.js';

export const DEFAULTS = {
  isotope: 'F-18',
  positronRange: true,
  nonCollinearity: true,
  attenuation: true,
  scatter: false,           // MUST: gamma rays travel in straight lines (no Compton scatter)
  activity: 5e7,            // decays per second in the whole phantom (≈5 kBq/mL in a 9 L body)
  efficiency: 0.8,          // probability that a photon reaching a crystal is detected
  energyResolution: 0.12,   // FWHM fraction at 511 keV
  windowLow: 425, windowHigh: 650, // keV
  timingResolution: 400,    // coincidence timing resolution (CTR), ps FWHM
  autoWindow: true,         // coincidence window = max flight-time difference in the FOV + 2·CTR
  coincidenceWindow: 4,     // ns, used when autoWindow is off
  tof: false,               // use the measured Δt to localise along the LOR (reconstruction only)
  ringRadius: 40,           // cm
  crystals: 512,            // per ring (≈4.9 mm crystal pitch)
  rings: 24,                // number of detector rings
  ringPitch: 0.5,           // cm (axial crystal size) → 12 cm axial field of view
  maxRingDiff: 23,          // accept LORs between rings up to this far apart (0 = 2D, direct planes only)
  fovRadius: 14,            // cm: LORs that miss this circle are discarded
  beds: 1,                  // number of bed (gurney) positions
  bedStep: 10,              // cm between bed positions
  bedDwell: 1               // acquire() calls spent at one bed position before moving on
};

export const coincidenceWindowNs = cfg =>
  cfg.autoWindow ? 2 * cfg.fovRadius / C_CM_PER_NS + 2 * cfg.timingResolution / 1000 : cfg.coincidenceWindow;

// Single-window coincidence sorter: a window of width tau opens on each unpaired single; exactly
// two singles in the window form a prompt coincidence, more than two are discarded as a multiple.
// P must hold singles with a measured time t. Returns the singles that are not yet safe to close.
export function sortCoincidences(P, safeTime, tau, onPair, onMultiple) {
  P.sort((a, b) => a.t - b.t);
  let i = 0;
  while (i < P.length && P[i].t + tau < safeTime) {
    let j = i + 1;
    while (j < P.length && P[j].t - P[i].t <= tau) j++;
    const inWindow = j - i;
    if (inWindow === 2) onPair(P[i], P[i + 1]);
    else if (inWindow > 2) onMultiple(inWindow);
    i = j;
  }
  return P.slice(i);
}

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

  get axialLength() {return this.config.rings * this.config.ringPitch;}
  get window() {return coincidenceWindowNs(this.config);}
  // Bed offsets (cm): the patient frame z equals scanner z + bed offset.
  get bedOffsets() {
    const n = Math.max(1, Math.round(this.config.beds)), st = this.config.bedStep;
    return Array.from({length: n}, (_, i) => (i - (n - 1) / 2) * st);
  }
  get bed() {const b = this.bedOffsets; return b[this.bedIndex % b.length];}

  reset() {
    this.time = 0;                 // ns of simulated acquisition
    this.bedIndex = 0; this.bedCalls = 0;
    this.pending = [];             // detected singles waiting for the coincidence sorter
    this.counts = {decays: 0, photonsDetected: 0, singles: 0, prompts: 0, trues: 0, scatters: 0, randoms: 0,
      multiples: 0, outsideFov: 0, ringDiff: 0};
    this.spectrum = new Float64Array(140);       // detected single energies, 5 keV bins 0–700 keV
    this.recent = [];                            // recent coincidences for display
    this.events = [];                            // list-mode record (for CSV)
    this.maxEvents = 200000;
    this.crystalHits = new Float32Array(this.config.crystals);
    this.ringHits = new Float32Array(this.config.rings);
    this.lastAnnihilation = null;
  }

  // Crystal centre in the scanner frame. Global crystal id = ring · crystals + angular index.
  crystalCenter(id) {
    const n = this.config.crystals, ring = Math.floor(id / n), j = id - ring * n;
    const a = (j + 0.5) * 2 * Math.PI / n, R = this.config.ringRadius;
    return [R * Math.cos(a), R * Math.sin(a), -this.axialLength / 2 + (ring + 0.5) * this.config.ringPitch];
  }

  // Simulate one decay at time t (ns) with the patient at bed offset `bed`.
  // Returns detected singles carrying the true arrival time tTrue and a standard-normal g
  // (the measured time is tTrue + σ·g, applied in acquire so that studies can vary σ).
  // If `record` is true, also return full geometry for the animation.
  decay(t, id, record = false, bed = this.bed) {
    const cfg = this.config, rand = this.rand, half = this.axialLength / 2;
    const emission = this.phantom.sampleEmission(rand);
    if (!emission) return null;
    let [x, y, z] = emission, track = null;
    if (cfg.positronRange) {
      // Range scales inversely with the density of the material the positron travels in.
      const scale = 0.1 / Math.max(this.phantom.densityAt(x, y, z), 0.05); // mm → cm, density-scaled
      let d;
      if (record) {
        const run = this.positron.run3D();
        track = run.path2d.map(([px, py]) => [px * scale * 10, py * scale * 10]); // mm, for the inset
        d = run.displacement;
      } else d = this.positron.sample();
      x += d[0] * scale; y += d[1] * scale; z += d[2] * scale;
    }
    const det = {R: cfg.ringRadius, zLo: bed - half, zHi: bed + half};
    const axis = isotropic(rand);
    if (!cfg.scatter && !record) {
      // Speed-up: if both straight photon lines miss the ring stack by more than 2 cm, nothing can be
      // detected. (Non-collinearity tilts the photons by ≲0.02°·10, far less than this margin.)
      const p = [x, y, z], m = 2;
      const z1 = straightHitZ(p, axis, cfg.ringRadius), z2 = straightHitZ(p, [-axis[0], -axis[1], -axis[2]], cfg.ringRadius);
      const miss = zh => zh === null || zh < det.zLo - m || zh > det.zHi + m;
      if (miss(z1) && miss(z2)) return {singles: [], emission, annihilation: [x, y, z], photons: [], track, bed};
    }
    const ann = annihilate(rand, {nonCollinearity: cfg.nonCollinearity}, axis);
    this.lastAnnihilation = ann;
    const singles = [], photons = [];
    for (const ph of ann.photons) {
      // Fast path (no scatter): a photon whose straight line misses the ring stack cannot be detected.
      if (!cfg.scatter && !record) {
        const zh = straightHitZ([x, y, z], ph.dir, cfg.ringRadius);
        if (zh === null || zh < det.zLo || zh > det.zHi) {photons.push({detected: false, escaped: true}); continue;}
      }
      const res = transportPhoton(rand, this.phantom, [x, y, z], ph.dir, ph.E, det,
        {attenuation: cfg.attenuation, scatter: cfg.scatter, record});
      const info = {...res, detected: false, inWindow: false, measuredE: 0, crystal: -1};
      photons.push(info);
      if (res.absorbed || res.escaped) continue;
      if (rand() >= cfg.efficiency) continue;          // detection efficiency
      const sigmaE = cfg.energyResolution / 2.355 * Math.sqrt(ME_KEV * res.E);
      const measured = res.E + sigmaE * gaussian(rand);
      const bin = Math.floor(measured / 5);
      if (bin >= 0 && bin < this.spectrum.length) this.spectrum[bin]++;
      this.counts.photonsDetected++;
      let a = res.angle; if (a < 0) a += 2 * Math.PI;
      const ang = Math.min(cfg.crystals - 1, Math.floor(a / (2 * Math.PI) * cfg.crystals));
      const ring = Math.max(0, Math.min(cfg.rings - 1, Math.floor((res.z - bed + half) / cfg.ringPitch)));
      const crystal = ring * cfg.crystals + ang;
      this.crystalHits[ang] += 1; this.ringHits[ring] += 1;
      Object.assign(info, {detected: true, measuredE: measured, crystal});
      if (measured < cfg.windowLow || measured > cfg.windowHigh) continue;
      info.inWindow = true;
      singles.push({tTrue: t + res.length / C_CM_PER_NS, g: gaussian(rand), crystal, E: measured,
        decay: id, scattered: res.scatters > 0, ax: x, ay: y, az: z, bed});
    }
    return {singles, emission, annihilation: [x, y, z], ann, photons, track, bed};
  }

  // Acquire n decays at the current bed position, then move to the next bed (if several).
  // Returns the first decay's full geometry if recordFirst is set.
  acquire(n, {recordFirst = false, flush = false} = {}) {
    const cfg = this.config, meanGap = 1e9 / cfg.activity;
    // Each detector time-stamps with jitter; two of them combine to the CTR.
    const sigmaT = cfg.timingResolution / 1000 / 2.355 / Math.SQRT2;
    const bed = this.bed;
    let featured = null;
    for (let k = 0; k < n; k++) {
      this.time += exponential(this.rand, 1 / meanGap);
      const id = this.counts.decays++;
      const d = this.decay(this.time, id, recordFirst && k === 0, bed);
      if (!d) continue;
      if (recordFirst && k === 0) featured = d;
      for (const s of d.singles) {s.t = s.tTrue + sigmaT * s.g; this.pending.push(s);}
      this.counts.singles += d.singles.length;
    }
    // Move the gurney after `bedDwell` calls (sorting is flushed first: no coincidence spans two beds).
    const moveBed = this.bedOffsets.length > 1 && ++this.bedCalls >= cfg.bedDwell;
    // Every single from decays before `safe` has already arrived, so the sorter can close them.
    const maxFlight = 2 * cfg.ringRadius / C_CM_PER_NS + 5 * cfg.timingResolution / 1000;
    this.sort(flush || moveBed ? Infinity : this.time - maxFlight - this.window);
    if (moveBed) {this.bedIndex = (this.bedIndex + 1) % this.bedOffsets.length; this.bedCalls = 0;}
    return featured;
  }

  sort(safeTime) {
    this.pending = sortCoincidences(this.pending, safeTime, this.window,
      (a, b) => this.record(a, b), () => this.counts.multiples++);
  }

  record(a, b) {
    const cfg = this.config, ev = makeEvent(this, a, b);
    if (!ev) return;
    if (ev.reject) {this.counts[ev.reject]++; return;}
    this.counts.prompts++;
    this.counts[ev.type === 'true' ? 'trues' : ev.type === 'scatter' ? 'scatters' : 'randoms']++;
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
      promptRate: c.prompts / seconds,
      singlesRate: c.singles / seconds
    };
  }
}

// Build a coincidence event from two singles (a arrived first). Returns {reject: counterName}
// for pairs the scanner discards, or null for a pair in the same crystal.
export function makeEvent(scanner, a, b) {
  const cfg = scanner.config;
  if (a.crystal === b.crystal) return null;
  const r1 = Math.floor(a.crystal / cfg.crystals), r2 = Math.floor(b.crystal / cfg.crystals);
  if (Math.abs(r1 - r2) > cfg.maxRingDiff) return {reject: 'ringDiff'};
  const [x1, y1, z1] = scanner.crystalCenter(a.crystal), [x2, y2, z2] = scanner.crystalCenter(b.crystal);
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 1e-9 || Math.abs((x1 * y2 - x2 * y1) / L) > cfg.fovRadius) return {reject: 'outsideFov'};
  const type = a.decay !== b.decay ? 'random' : (a.scattered || b.scattered ? 'scatter' : 'true');
  // a arrived first, so the annihilation is closer to crystal a by c·Δt/2.
  return {t: a.t, c1: a.crystal, c2: b.crystal, r1, r2, x1, y1, z1, x2, y2, z2, bed: a.bed, dt: b.t - a.t,
    E1: a.E, E2: b.E, type,
    ax: type === 'random' ? null : a.ax, ay: type === 'random' ? null : a.ay, az: type === 'random' ? null : a.az};
}
