// npm run study — headless detectability study for the MUST / SHOULD / COULD parts.
//
//   node study.mjs            full study (≈10 min)
//   node study.mjs --quick    fewer decays and grid points (≈1 min), for checking the pipeline
//   node study.mjs --part must | should | could     run only one section group (to use several CPU cores)
//
// Method: "common random numbers". One simulation is run with a perfect detector (efficiency 1);
// every detected photon gets a uniform number u and a standard-normal number g. A detector with
// efficiency ε keeps exactly the photons with u < ε, and a detector with timing resolution CTR
// time-stamps them at t_true + σ(CTR)·g. This is statistically identical to separate simulations,
// but all grid points see the same decays, so trends are smooth and cheap to compute.
import {writeFileSync, mkdirSync} from 'node:fs';
import {Scanner, sortCoincidences, makeEvent, coincidenceWindowNs} from './engine/scanner.js';
import {makeTumorPhantom} from './engine/phantom.js';
import {exponential} from './engine/random.js';
import {C_CM_PER_NS} from './engine/photon.js';
import {Reconstructor} from './recon/reconstruction.js';
import {tumorCNR, ROSE_K} from './recon/detectability.js';

const QUICK = process.argv.includes('--quick');
const PART = process.argv.includes('--part') ? process.argv[process.argv.indexOf('--part') + 1] : 'all';
const RUN_MUST = PART === 'all' || PART === 'must', RUN_REST = PART === 'all' || PART === 'should', RUN_COULD = PART === 'all' || PART === 'could';
const OUT = 'results';
mkdirSync(OUT, {recursive: true});

const BASE = {activity: 5e7, efficiency: 1, timingResolution: 400, scatter: false};
const TUMOR = {ratio: 5, radius: 1, x: 4, y: 2, z: 0};
const N_DECAYS = QUICK ? 4e6 : 2e7;          // one simulated scan ≈ 0.4 s at 5e7 Bq
const SEEDS = QUICK ? [1] : [1, 2, 3];          // MUST grid
const SEEDS2 = QUICK ? [1] : [1, 2];            // other sections
const MLEM_ITERS = 6;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Run one simulated scan and feed every (efficiency, CTR) configuration from the same singles.
// configs: [{eff, ctr, cfg?}] → each gets {recon, counts}.
function runShared({phantomOpts = TUMOR, scanner = {}, configs, seed, nDecays = N_DECAYS, slabZ = TUMOR.z}) {
  const ph = makeTumorPhantom(phantomOpts);
  const sc = new Scanner(ph, {...BASE, ...scanner, efficiency: 1}, 1000 + seed);
  const ctrs = [...new Set(configs.map(c => c.ctr))];
  for (const c of configs) {
    c.recon = new Reconstructor({seed: 7 + seed});
    c.recon.setAxial({z0: slabZ - 0.5, dz: 0.5, nSlices: 2});      // 1 cm slab through the tumor centre
    c.recon.setGeometry(sc.config, sc.bedOffsets);
    c.recon.setAttenuationFromPhantom(ph);
    c.counts = {trues: 0, scatters: 0, randoms: 0, multiples: 0, prompts: 0};
    c.pending = [];
    c.cfg = {...sc.config, timingResolution: c.ctr};
    c.tau = coincidenceWindowNs(c.cfg);
    c.view = {config: c.cfg, crystalCenter: id => sc.crystalCenter(id)};
  }
  const beds = sc.bedOffsets, chunk = 5e5, meanGap = 1e9 / sc.config.activity;
  let t = 0, id = 0;
  const perBed = Math.ceil(nDecays / beds.length);
  for (const bed of beds) {
    for (let done = 0; done < perBed; done += chunk) {
      const singles = [];
      for (let k = 0; k < chunk && done + k < perBed; k++) {
        t += exponential(sc.rand, 1 / meanGap);
        const d = sc.decay(t, id++, false, bed);
        if (!d) continue;
        for (const s of d.singles) {s.u = sc.rand(); singles.push(s);}
      }
      const last = done + chunk >= perBed;              // flush at the end of each bed position
      for (const ctr of ctrs) {
        const sigma = ctr / 1000 / 2.355 / Math.SQRT2;
        const timed = singles.map(s => ({...s, t: s.tTrue + sigma * s.g}));
        const maxFlight = 2 * sc.config.ringRadius / C_CM_PER_NS + 5 * ctr / 1000;
        for (const c of configs) {
          if (c.ctr !== ctr) continue;
          for (const s of timed) if (s.u < c.eff) c.pending.push(s);
          c.pending = sortCoincidences(c.pending, last ? Infinity : t - maxFlight - c.tau, c.tau, (a, b) => {
            const ev = makeEvent(c.view, a, b);
            if (!ev || ev.reject) return;
            c.counts.prompts++; c.counts[ev.type === 'true' ? 'trues' : ev.type === 'scatter' ? 'scatters' : 'randoms']++;
            c.recon.add(ev);
          }, () => c.counts.multiples++);
        }
      }
    }
  }
  return {phantom: ph, scanner: sc, seconds: t * 1e-9};
}

function measure(c, ph, z, tof) {
  const img = c.recon.listModeMLEM(true, c.ctr, MLEM_ITERS, [0, 1], tof);
  const r = tumorCNR(img, c.recon, ph, z);
  return {cnr: r?.cnr ?? NaN, contrast: r?.contrast ?? NaN, img};
}

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / Math.max(1, a.length - 1));
function csv(name, rows) {
  const keys = Object.keys(rows[0]);
  writeFileSync(`${OUT}/${name}.csv`, [keys.join(','), ...rows.map(r => keys.map(k => typeof r[k] === 'number' ? +r[k].toPrecision(5) : r[k]).join(','))].join('\n') + '\n');
}
const summary = [];

// ---------------------------------------------------------------------------------------------
// MUST: minimum detection efficiency and timing resolution (non-TOF reconstruction).
// ---------------------------------------------------------------------------------------------
if (RUN_MUST) {
  const effs = QUICK ? [0.2, 0.5, 1] : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0];
  const ctrs = QUICK ? [400, 4000, 16000] : [250, 500, 1000, 2000, 4000, 8000, 16000, 32000];
  const acc = new Map();
  for (const seed of SEEDS) {
    const configs = effs.flatMap(eff => ctrs.map(ctr => ({eff, ctr})));
    log(`MUST grid: seed ${seed}, ${configs.length} detector configurations, ${N_DECAYS.toExponential(1)} decays`);
    const {phantom, seconds} = runShared({configs, seed});
    for (const c of configs) {
      const m = measure(c, phantom, TUMOR.z, false), key = `${c.eff}|${c.ctr}`;
      if (!acc.has(key)) acc.set(key, {eff: c.eff, ctr: c.ctr, cnr: [], contrast: [], trues: [], randoms: [], window: c.tau, seconds});
      const a = acc.get(key);
      a.cnr.push(m.cnr); a.contrast.push(m.contrast); a.trues.push(c.counts.trues); a.randoms.push(c.counts.randoms);
    }
  }
  const rows = [...acc.values()].map(a => ({
    efficiency: a.eff, ctr_ps: a.ctr, window_ns: a.window, scan_s: a.seconds,
    trues: mean(a.trues), randoms: mean(a.randoms), random_fraction: mean(a.randoms) / (mean(a.trues) + mean(a.randoms)),
    cnr: mean(a.cnr), cnr_sd: sd(a.cnr), contrast: mean(a.contrast), detected: mean(a.cnr) >= ROSE_K ? 'yes' : 'no'
  }));
  csv('must_grid', rows);
  // Minimum efficiency for each CTR (linear interpolation of CNR between grid points).
  const minRows = ctrs.map(ctr => {
    const r = rows.filter(x => x.ctr_ps === ctr).sort((a, b) => a.efficiency - b.efficiency);
    let emin = NaN;
    for (let i = 0; i < r.length; i++) if (r[i].cnr >= ROSE_K) {
      emin = i === 0 ? r[0].efficiency : r[i - 1].efficiency + (ROSE_K - r[i - 1].cnr) / (r[i].cnr - r[i - 1].cnr) * (r[i].efficiency - r[i - 1].efficiency);
      break;
    }
    // Fit CNR = k·ε through the origin (NEC ∝ ε² ⇒ CNR ∝ ε).
    const k = r.reduce((s, x) => s + x.cnr * x.efficiency, 0) / r.reduce((s, x) => s + x.efficiency ** 2, 0);
    return {ctr_ps: ctr, window_ns: r[0].window_ns, random_fraction: r[r.length - 1].random_fraction, cnr_per_efficiency: k, min_efficiency_interp: emin, min_efficiency_fit: ROSE_K / k};
  });
  csv('must_min_efficiency', minRows);
  // Worst (largest) timing resolution that still detects the tumor, for each efficiency, using the
  // fitted CNR = k(CTR)·ε (less sensitive to the noise of single grid points).
  const maxCtr = effs.map(eff => {
    let worst = null; for (const m of minRows) {if (m.cnr_per_efficiency * eff >= ROSE_K) worst = m.ctr_ps; else break;}
    return {efficiency: eff, worst_ctr_ps_detected: worst ?? 'none'};
  });
  csv('must_max_ctr', maxCtr);
  summary.push('## MUST: minimum detector performance (non-TOF list-mode MLEM)', '',
    `Tumor: sphere r = ${TUMOR.radius} cm, uptake ${TUMOR.ratio}:1, at (${TUMOR.x}, ${TUMOR.y}, ${TUMOR.z}) cm in a 22 cm × 24 cm water cylinder; ` +
    `activity ${BASE.activity.toExponential(1)} Bq; ${N_DECAYS.toExponential(1)} decays per scan (${rows[0].scan_s.toFixed(2)} s); ${SEEDS.length} seed(s). Detected ⇔ CNR ≥ ${ROSE_K}.`, '',
    '| CTR (ps) | window (ns) | randoms fraction (ε=1) | CNR per unit ε | minimum ε |', '|---|---|---|---|---|',
    ...minRows.map(r => `| ${r.ctr_ps} | ${r.window_ns.toFixed(2)} | ${(100 * r.random_fraction).toFixed(1)} % | ${r.cnr_per_efficiency.toFixed(2)} | ${r.min_efficiency_fit > 1 ? 'not detectable' : r.min_efficiency_fit.toFixed(2)} |`), '',
    '| efficiency ε | worst CTR that still detects (ps) |', '|---|---|', ...maxCtr.map(r => `| ${r.efficiency} | ${r.worst_ctr_ps_detected} |`), '');
  log('MUST done');
}

// ---------------------------------------------------------------------------------------------
// SHOULD 1: time-of-flight. Same data, reconstructed with and without the TOF kernel.
// ---------------------------------------------------------------------------------------------
if (RUN_REST) {
  const eff = 0.5, ctrs = QUICK ? [200, 800] : [100, 200, 300, 400, 600, 800, 1200, 2000];
  const acc = new Map();
  for (const seed of QUICK ? SEEDS2 : [1, 2, 3, 4]) {
    const configs = ctrs.map(ctr => ({eff, ctr}));
    log(`SHOULD TOF: seed ${seed}`);
    const {phantom} = runShared({configs, seed: seed + 10});
    for (const c of configs) {
      const a = acc.get(c.ctr) ?? {non: [], tof: []};
      a.non.push(measure(c, phantom, TUMOR.z, false).cnr); a.tof.push(measure(c, phantom, TUMOR.z, true).cnr);
      acc.set(c.ctr, a);
    }
  }
  const D = 22;   // body diameter, cm
  const rows = ctrs.map(ctr => {
    const a = acc.get(ctr), dx = C_CM_PER_NS * ctr / 1000 / 2;
    return {ctr_ps: ctr, tof_fwhm_cm: dx, cnr_nontof: mean(a.non), cnr_tof: mean(a.tof), gain: mean(a.tof) / mean(a.non), gain_theory_sqrt_D_over_dx: Math.sqrt(Math.max(1, D / dx))};
  });
  csv('should_tof', rows);
  summary.push(`## SHOULD: time of flight (ε = ${eff}; same events reconstructed without and with TOF)`, '', '| CTR (ps) | Δx = cΔt/2 (cm) | CNR non-TOF | CNR TOF | gain | √(D/Δx) |', '|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.ctr_ps} | ${r.tof_fwhm_cm.toFixed(1)} | ${r.cnr_nontof.toFixed(1)} | ${r.cnr_tof.toFixed(1)} | ${r.gain.toFixed(2)} | ${r.gain_theory_sqrt_D_over_dx.toFixed(2)} |`), '');
  log('TOF done');
}

// ---------------------------------------------------------------------------------------------
// SHOULD 2: 3D detection. A tumor 9 cm off the scanner centre, outside the 12 cm axial FOV:
// 2D vs 3D acquisition, and one, two or three bed positions in the same total scan time.
// ---------------------------------------------------------------------------------------------
if (RUN_REST) {
  const tz = 9, eff = 0.8, ctr = 400;
  const cases = [
    {name: '1 bed, 2D (septa: ring difference ≤ 3)', scanner: {beds: 1, maxRingDiff: 3}},
    {name: '1 bed, 3D (all ring differences)', scanner: {beds: 1}},
    {name: '2 beds, 3D (offsets ±5 cm)', scanner: {beds: 2, bedStep: 10}},
    {name: '3 beds, 3D (offsets 0, ±10 cm)', scanner: {beds: 3, bedStep: 10}},
    {name: 'reference: tumor at z = 0, 1 bed, 2D', scanner: {beds: 1, maxRingDiff: 3}, z: 0},
    {name: 'reference: tumor at z = 0, 1 bed, 3D', scanner: {beds: 1}, z: 0}
  ];
  const rows = [];
  for (const cs of cases) {
    const z = cs.z ?? tz, cnr = [], trues = [];
    for (const seed of SEEDS2) {
      const configs = [{eff, ctr}];
      const {phantom} = runShared({phantomOpts: {...TUMOR, z}, scanner: cs.scanner, configs, seed: seed + 20, slabZ: z});
      const m = measure(configs[0], phantom, z, false);
      cnr.push(m.cnr); trues.push(configs[0].recon.inSlices);
    }
    rows.push({case: cs.name, tumor_z_cm: z, trues_in_slab: mean(trues), cnr: mean(cnr), detected: mean(cnr) >= ROSE_K ? 'yes' : 'no'});
    log(`3D: ${cs.name} → CNR ${mean(cnr).toFixed(1)}`);
  }
  csv('should_3d', rows);
  summary.push(`## SHOULD: 3D detection (tumor at z = ${tz} cm; scanner axial FOV ±6 cm; same total decays)`, '', '| case | tumor z | coincidences in 1 cm slab | CNR | detected |', '|---|---|---|---|---|',
    ...rows.map(r => `| ${r.case} | ${r.tumor_z_cm} | ${Math.round(r.trues_in_slab)} | ${Number.isFinite(r.cnr) ? r.cnr.toFixed(1) : '–'} | ${r.detected} |`), '');
}

// ---------------------------------------------------------------------------------------------
// COULD: Compton scatter in the patient, accepted or rejected by the energy window.
// ---------------------------------------------------------------------------------------------
if (RUN_COULD) {
  const eff = 0.8, ctr = 400;
  const cases = [
    {name: 'no scatter (MUST model)', scanner: {scatter: false}},
    {name: 'scatter, 425–650 keV window', scanner: {scatter: true}},
    {name: 'scatter, wide 250–650 keV window', scanner: {scatter: true, windowLow: 250}}
  ];
  const rows = [];
  for (const cs of cases) {
    const cnr = [], sf = [], contrast = [];
    for (const seed of SEEDS2) {
      const configs = [{eff, ctr}];
      const {phantom} = runShared({scanner: cs.scanner, configs, seed: seed + 30, nDecays: N_DECAYS / 2});
      const m = measure(configs[0], phantom, TUMOR.z, false), k = configs[0].counts;
      cnr.push(m.cnr); contrast.push(m.contrast); sf.push(k.scatters / Math.max(1, k.trues + k.scatters));
    }
    rows.push({case: cs.name, scatter_fraction: mean(sf), contrast: mean(contrast), cnr: mean(cnr)});
    log(`Scatter: ${cs.name} → SF ${mean(sf).toFixed(2)}, CNR ${mean(cnr).toFixed(1)}`);
  }
  csv('could_scatter', rows);
  summary.push(`## COULD: Compton scatter (ε = ${eff}, CTR = ${ctr} ps; ${(N_DECAYS / 2).toExponential(1)} decays per case, because scatter tracking is slower)`, '',
    '| case | scatter fraction | tumor contrast | CNR |', '|---|---|---|---|',
    ...rows.map(r => `| ${r.case} | ${(100 * r.scatter_fraction).toFixed(1)} % | ${r.contrast.toFixed(2)} | ${r.cnr.toFixed(1)} |`), '');
}

writeFileSync(`${OUT}/summary${PART === 'all' ? '' : '_' + PART}.md`, `${PART === 'all' || PART === 'must' ? `# PET tumor detectability study${QUICK ? ' (quick run)' : ''}\n\n` : ''}${summary.join('\n')}`);
log(`wrote ${OUT}/summary.md and CSV files`);
