// npm test — physics, detector and reconstruction checks for the 3D PET model.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {rng, gaussian} from './engine/random.js';
import {annihilate, ME_KEV} from './engine/annihilation.js';
import {comptonEnergy, sampleKleinNishina, transportPhoton} from './engine/photon.js';
import {PositronTransport, ISOTOPES} from './engine/positron.js';
import {Phantom, PHANTOMS, makeTumorPhantom} from './engine/phantom.js';
import {Scanner} from './engine/scanner.js';
import {Reconstructor} from './recon/reconstruction.js';
import {lesionCNR} from './recon/detectability.js';

const results = [];
const check = (name, pass, detail) => {results.push({check: name, result: pass ? 'PASS' : 'FAIL', detail}); assert.ok(pass, `${name}: ${detail}`);};

// 1. Annihilation conserves energy and momentum (exact relativistic kinematics, 3D).
{
  const r = rng(1); let maxE = 0, maxP = 0; const offsets = [];
  for (let i = 0; i < 20000; i++) {
    const a = annihilate(r);
    maxE = Math.max(maxE, Math.abs(a.energyError)); maxP = Math.max(maxP, a.momentumError);
    // Deviation from back-to-back, projected on one direction perpendicular to photon 1.
    const [d1, d2] = a.photons.map(p => p.dir);
    let e = [d1[1], -d1[0], 0]; const L = Math.hypot(...e); e = e.map(v => v / L);
    offsets.push(Math.asin((d1[0] + d2[0]) * e[0] + (d1[1] + d2[1]) * e[1]));
  }
  check('Annihilation energy conserved', maxE < 1e-9, `max |E1+E2−E| = ${maxE.toExponential(2)} keV`);
  check('Annihilation momentum conserved', maxP < 1e-9, `max |p1+p2−p| = ${maxP.toExponential(2)} keV/c`);
  const sd = Math.sqrt(offsets.reduce((s, x) => s + x * x, 0) / offsets.length);
  const fwhm = 2.355 * sd * 180 / Math.PI;
  check('Non-collinearity ≈ 0.5° FWHM (one projection)', Math.abs(fwhm - 0.5) < 0.05, `${fwhm.toFixed(3)}°`);
  const still = annihilate(r, {nonCollinearity: false});
  check('Pair at rest: two 511 keV photons at 180°', Math.abs(still.photons[0].E - ME_KEV) < 1e-12 && still.deviationDeg < 1e-6,
    `${still.photons[0].E} keV, deviation ${still.deviationDeg.toExponential(1)}°`);
  // Photon directions are isotropic in 3D: ⟨cos²θ⟩ = 1/3.
  let c2 = 0; for (let i = 0; i < 20000; i++) c2 += annihilate(r).photons[0].dir[2] ** 2;
  check('Emission isotropic in 3D', Math.abs(c2 / 20000 - 1 / 3) < 0.01, `⟨cos²θ⟩ = ${(c2 / 20000).toFixed(4)} (expect 0.3333)`);
}

// 2. Compton kinematics and Klein–Nishina sampling (used by the optional scatter model).
{
  const back = comptonEnergy(511, -1);
  check('Compton backscatter energy = 170.3 keV', Math.abs(back - 511 / 3) < 1e-9, `${back.toFixed(3)} keV`);
  const r = rng(2); let mc = 0; const N = 200000;
  for (let i = 0; i < N; i++) mc += sampleKleinNishina(r, 511);
  let num = 0, den = 0;
  for (let i = 0; i < 20000; i++) {const c = -1 + (i + 0.5) / 10000, P = 1 / (1 + (1 - c)); const f = P * P * (P + 1 / P - (1 - c * c)); num += c * f; den += f;}
  check('Klein–Nishina ⟨cos θ⟩ matches integral', Math.abs(mc / N - num / den) < 0.005, `MC ${(mc / N).toFixed(4)} vs exact ${(num / den).toFixed(4)}`);
}

// 3. Attenuation: unscattered survival through 10 cm of water = exp(−μL), for the straight-line
//    model (MUST) and for Woodcock tracking with scatter on (COULD).
{
  const ph = new Phantom('w', [{x: 0, y: 0, r: 10, z0: -50, z1: 50, material: 'water', conc: 1}]), det = {R: 40, zLo: -100, zHi: 100};
  const expect = Math.exp(-0.096 * 10);
  for (const scatter of [false, true]) {
    const r = rng(3); let survive = 0; const N = 100000;
    for (let i = 0; i < N; i++) {
      const a = 2 * Math.PI * r();
      const res = transportPhoton(r, ph, [0, 0, 0], [Math.cos(a), Math.sin(a), 0], 511, det, {attenuation: true, scatter});
      if (!res.absorbed && res.scatters === 0) survive++;
    }
    check(`Beer–Lambert attenuation (${scatter ? 'Woodcock' : 'straight line'})`, Math.abs(survive / N - expect) < 0.005,
      `${(survive / N).toFixed(4)} vs exp(−μL) = ${expect.toFixed(4)}`);
  }
}

// 4. Positron range calibrated to published means (water).
for (const key of Object.keys(ISOTOPES)) {
  const p = new PositronTransport(rng(4)); p.setIsotope(key);
  let m = 0; for (let i = 0; i < 4000; i++) m += Math.hypot(...p.sample());
  m /= 4000;
  check(`Positron mean range ${key}`, Math.abs(m / ISOTOPES[key].meanRange - 1) < 0.05, `${m.toFixed(3)} mm vs ${ISOTOPES[key].meanRange} mm`);
}

// 5. Exact 3D line integral of mu agrees with numerical integration (oblique line through the torso).
{
  const ph = PHANTOMS.torso.make(), p0 = [-15, -6, -9], p1 = [14, 9, 11];
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), M = 200000;
  let num = 0;
  for (let i = 0; i < M; i++) {const f = (i + 0.5) / M; num += ph.muAt(...p0.map((v, k) => v + f * (p1[k] - v))) * L / M;}
  const exact = ph.muLineIntegral(p0, p1);
  check('3D line integral of μ (attenuation)', Math.abs(num - exact) < 1e-3, `${exact.toFixed(5)} vs numeric ${num.toFixed(5)}`);
}

// 6. Emission density follows the tracer: tumor/background counts per volume = uptake ratio.
{
  const ph = makeTumorPhantom({ratio: 5, radius: 2, x: 3, y: 0, z: 0}), r = rng(6);
  let inT = 0, inB = 0;
  for (let i = 0; i < 400000; i++) {
    const [x, y, z] = ph.sampleEmission(r);
    if (Math.hypot(x - 3, y, z) < 2) inT++; else inB++;
  }
  const vT = 4 / 3 * Math.PI * 8, vB = Math.PI * 121 * 24 - vT, ratio = (inT / vT) / (inB / vB);
  check('Emission density ∝ concentration (3D tumor)', Math.abs(ratio / 5 - 1) < 0.05, `measured ${ratio.toFixed(2)} : 1 (set 5 : 1)`);
}

// 7. Coincidence sorter: pair, isolated single and a triple.
{
  const sc = new Scanner(PHANTOMS.uniform.make());
  const s = (t, crystal, decay) => ({t, crystal, decay, E: 511, scattered: false, ax: 0, ay: 0, az: 0, bed: 0});
  sc.pending = [s(0, 0, 1), s(1, 256, 1), s(100, 10, 2), s(200, 20, 3), s(200.5, 300, 3), s(201, 60, 4)];
  sc.sort(Infinity);
  check('Coincidence sorter', sc.counts.trues === 1 && sc.counts.multiples === 1 && sc.counts.prompts === 1,
    `trues ${sc.counts.trues}, multiples ${sc.counts.multiples}`);
}

// 8. Detector model: pairs are recorded with probability ε², and randoms grow with activity.
{
  const trues = eff => {const sc = new Scanner(PHANTOMS.uniform.make(), {efficiency: eff, activity: 1e5}, 8); sc.acquire(600000); sc.acquire(0, {flush: true}); return sc.counts.trues;};
  const ratio = trues(0.5) / trues(1);
  check('Trues ∝ efficiency²', Math.abs(ratio - 0.25) < 0.02, `trues(ε=0.5)/trues(ε=1) = ${ratio.toFixed(3)} (expect 0.25)`);
  const frac = A => {const sc = new Scanner(PHANTOMS.uniform.make(), {activity: A}, 7); sc.acquire(1500000); return sc.counts.randoms / sc.counts.decays;};
  const f1 = frac(1e7), f2 = frac(5e7), r = f2 / f1;
  check('Randoms scale with activity', r > 3.5 && r < 6.5, `randoms per decay ×${r.toFixed(2)} for activity ×5 (expect ≈5)`);
  // A worse timing resolution widens the (automatic) window: no trues are lost at low activity
  // (the window still contains every true pair), but at high activity randoms (and multiples) grow.
  const run = (ctr, A) => {const sc = new Scanner(PHANTOMS.uniform.make(), {activity: A, timingResolution: ctr}, 9); sc.acquire(400000); return sc.counts;};
  const a = run(400, 1e5), b = run(8000, 1e5), c = run(400, 5e7), d = run(8000, 5e7);
  check('Coarse timing keeps trues (low activity)', Math.abs(b.trues / a.trues - 1) < 0.02, `trues ${a.trues} → ${b.trues} for CTR 0.4 → 8 ns`);
  check('Coarse timing adds randoms (50 MBq)', d.randoms > 4 * c.randoms && d.multiples > c.multiples,
    `randoms ${c.randoms} → ${d.randoms}, multiples ${c.multiples} → ${d.multiples}, trues ${c.trues} → ${d.trues}`);
}

// 9. Reconstruction of point sources in air: FBP positions, MLEM count conservation, TOF centring.
{
  const sc = new Scanner(PHANTOMS.points.make(), {timingResolution: 100}, 8), rec = new Reconstructor();
  rec.setGeometry(sc.config, sc.bedOffsets);
  sc.onCoincidence = ev => rec.add(ev);
  for (let i = 0; i < 10; i++) sc.acquire(100000);
  const k0 = rec.sliceOf(-0.25), k1 = rec.sliceOf(0.24), n = rec.nPix;
  const img = rec.fbpFromSino(rec.sinoSlab(k0, k1));
  const centroid = (x0, y0, w, image) => {
    let sx = 0, sy = 0, sw = 0;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const x = -rec.fov + (ix + 0.5) * rec.pix, y = rec.fov - (iy + 0.5) * rec.pix;
      if (Math.hypot(x - x0, y - y0) > w) continue; const v = Math.max(0, image[iy * n + ix]); sx += v * x; sy += v * y; sw += v;
    }
    return [sx / sw, sy / sw];
  };
  for (const x0 of [0, 5, 10]) {
    const [cx, cy] = centroid(x0, 0, 1.5, img);
    check(`FBP point source at (${x0}, 0)`, Math.hypot(cx - x0, cy) < rec.pix, `centroid (${cx.toFixed(3)}, ${cy.toFixed(3)}) cm`);
  }
  const k = rec.sliceOf(0.1);
  rec.mlem(false, 5, k);
  const proj = rec.forwardProject(rec.mlemImage), y = rec.sinoSlab(k, k);
  let sp = 0, sy = 0; for (let i = 0; i < proj.length; i++) if (proj[i] > 0) {sp += proj[i]; sy += y[i];}
  check('MLEM preserves total counts', Math.abs(sp / sy - 1) < 1e-4, `Σ A·x / Σ y = ${(sp / sy).toFixed(7)}`);
  const tof = rec.tofBackprojection(false, 100, k), [tx, ty] = centroid(5, 0, 3, tof);
  check('TOF places events at the source', Math.hypot(tx - 5, ty) < 0.5, `centroid (${tx.toFixed(3)}, ${ty.toFixed(3)}) cm`);
}

// 10. Detectability measure: high CNR for a real lesion, |CNR| small for none.
{
  const rec = new Reconstructor(), n = rec.nPix, r = rng(10);
  const make = amp => {
    const img = new Float32Array(n * n);
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const x = -rec.fov + (ix + 0.5) * rec.pix, y = rec.fov - (iy + 0.5) * rec.pix;
      img[iy * n + ix] = Math.hypot(x, y) < 11 ? 1 + 0.3 * gaussian(r) + (Math.hypot(x - 4, y - 2) < 1 ? amp : 0) : 0;
    }
    return img;
  };
  const yes = lesionCNR(make(1), rec, {x: 4, y: 2, r: 1}, {x: 0, y: 0, r: 11}), no = lesionCNR(make(0), rec, {x: 4, y: 2, r: 1}, {x: 0, y: 0, r: 11});
  check('Lesion CNR measure', yes.cnr > 10 && Math.abs(no.cnr) < 4 && yes.bgRois.length >= 6, `with lesion ${yes.cnr.toFixed(1)}, without ${no.cnr.toFixed(1)}, ${yes.bgRois.length} background ROIs`);
}

// 11. 3D coverage: a tumor 9 cm along the patient is outside one bed's 12 cm FOV; bed steps reach it.
{
  const slabEvents = beds => {
    const ph = makeTumorPhantom({z: 9}), sc = new Scanner(ph, {beds}, 12), rec = new Reconstructor();
    rec.setAxial({z0: 8.5, dz: 0.5, nSlices: 2}); rec.setGeometry(sc.config, sc.bedOffsets); sc.onCoincidence = e => rec.add(e);
    for (let i = 0; i < 6; i++) sc.acquire(200000);
    return rec.inSlices;
  };
  const one = slabEvents(1), two = slabEvents(2);
  check('Bed stepping covers an off-centre tumor', one === 0 && two > 50, `events in tumor slab: 1 bed ${one}, 2 beds ${two}`);
}

// 12. Reproducible: same seed, same acquisition.
{
  const run = () => {const sc = new Scanner(PHANTOMS.torso.make(), {}, 11); sc.acquire(20000); return JSON.stringify(sc.counts);};
  check('Seeded acquisition is reproducible', run() === run(), 'identical counters');
}

// 13. Layering rule: no DOM inside engine/ or recon/.
{
  const bad = [];
  for (const dir of ['engine', 'recon']) for (const f of readdirSync(dir))
    if (/\b(document|window)\.|getContext\(|HTMLElement/.test(readFileSync(`${dir}/${f}`, 'utf8'))) bad.push(`${dir}/${f}`);
  check('No DOM in engine/ or recon/', bad.length === 0, bad.join(', ') || 'clean');
}

console.table(results);
console.log(`PASS: ${results.length} checks`);
