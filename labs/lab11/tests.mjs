// npm test — physics and reconstruction checks for the PET model.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {rng} from './engine/random.js';
import {annihilate, ME_KEV} from './engine/annihilation.js';
import {comptonEnergy, sampleKleinNishina, transportPhoton} from './engine/photon.js';
import {PositronTransport, ISOTOPES} from './engine/positron.js';
import {Phantom, PHANTOMS} from './engine/phantom.js';
import {Scanner} from './engine/scanner.js';
import {Reconstructor} from './recon/reconstruction.js';

const results = [];
const check = (name, pass, detail) => {results.push({check: name, result: pass ? 'PASS' : 'FAIL', detail}); assert.ok(pass, `${name}: ${detail}`);};

// 1. Annihilation conserves energy and momentum (exact relativistic kinematics).
{
  const r = rng(1); let maxE = 0, maxP = 0, offsets = [];
  for (let i = 0; i < 20000; i++) {
    const a = annihilate(r);
    maxE = Math.max(maxE, Math.abs(a.energyError)); maxP = Math.max(maxP, a.momentumError);
    const [d1, d2] = a.photons.map(p => p.dir);
    let off = Math.atan2(d2[1], d2[0]) - Math.atan2(d1[1], d1[0]) - Math.PI;
    offsets.push(Math.atan2(Math.sin(off), Math.cos(off)));
  }
  check('Annihilation energy conserved', maxE < 1e-9, `max |E1+E2−E| = ${maxE.toExponential(2)} keV`);
  check('Annihilation momentum conserved', maxP < 1e-9, `max |p1+p2−p| = ${maxP.toExponential(2)} keV/c`);
  const sd = Math.sqrt(offsets.reduce((s, x) => s + x * x, 0) / offsets.length);
  const fwhm = 2.355 * sd * 180 / Math.PI;
  check('Non-collinearity ≈ 0.5° FWHM', Math.abs(fwhm - 0.5) < 0.05, `${fwhm.toFixed(3)}°`);
  const still = annihilate(r, {nonCollinearity: false});
  check('Pair at rest: two 511 keV photons at 180°', Math.abs(still.photons[0].E - ME_KEV) < 1e-12 && still.deviationDeg < 1e-9,
    `${still.photons[0].E} keV, deviation ${still.deviationDeg.toExponential(1)}°`);
}

// 2. Compton kinematics and Klein–Nishina sampling.
{
  const back = comptonEnergy(511, -1);
  check('Compton backscatter energy = 170.3 keV', Math.abs(back - 511 / 3) < 1e-9, `${back.toFixed(3)} keV`);
  const r = rng(2); let mc = 0; const N = 200000;
  for (let i = 0; i < N; i++) mc += sampleKleinNishina(r, 511);
  let num = 0, den = 0;
  for (let i = 0; i < 20000; i++) {const c = -1 + (i + 0.5) / 10000, P = 1 / (1 + (1 - c)); const f = P * P * (P + 1 / P - (1 - c * c)); num += c * f; den += f;}
  check('Klein–Nishina ⟨cos θ⟩ matches integral', Math.abs(mc / N - num / den) < 0.005, `MC ${(mc / N).toFixed(4)} vs exact ${(num / den).toFixed(4)}`);
}

// 3. Attenuation: unscattered survival through 10 cm of water = exp(−μL).
{
  const ph = new Phantom('w', [{x: 0, y: 0, r: 10, material: 'water', conc: 1}]), r = rng(3);
  let survive = 0; const N = 100000;
  for (let i = 0; i < N; i++) {
    const a = 2 * Math.PI * r();
    const res = transportPhoton(r, ph, 0, 0, Math.cos(a), Math.sin(a), 511, 40, {attenuation: true, scatter: false});
    if (!res.absorbed) survive++;
  }
  const expect = Math.exp(-0.096 * 10);
  check('Beer–Lambert attenuation', Math.abs(survive / N - expect) < 0.005, `${(survive / N).toFixed(4)} vs exp(−μL) = ${expect.toFixed(4)}`);
}

// 4. Positron range calibrated to published means (water).
for (const key of Object.keys(ISOTOPES)) {
  const p = new PositronTransport(rng(4)); p.setIsotope(key);
  let m = 0; for (let i = 0; i < 4000; i++) m += Math.hypot(...p.sample());
  m /= 4000;
  check(`Positron mean range ${key}`, Math.abs(m / ISOTOPES[key].meanRange - 1) < 0.05, `${m.toFixed(3)} mm vs ${ISOTOPES[key].meanRange} mm`);
}

// 5. Exact line integral of mu agrees with numerical integration.
{
  const ph = PHANTOMS.torso.make(), phi = 0.7, s = 1.3, c = Math.cos(phi), sn = Math.sin(phi);
  let num = 0; const ds = 0.0005;
  for (let t = -15; t < 15; t += ds) num += ph.muAt(s * c - t * sn, s * sn + t * c) * ds;
  const exact = ph.lineIntegralMu(phi, s);
  check('Line integral of μ (attenuation correction)', Math.abs(num - exact) < 1e-3, `${exact.toFixed(5)} vs numeric ${num.toFixed(5)}`);
}

// 6. Coincidence sorter: pair, isolated single and a triple.
{
  const sc = new Scanner(PHANTOMS.uniform.make());
  const s = (t, crystal, decay) => ({t, crystal, decay, E: 511, scattered: false, ax: 0, ay: 0});
  sc.pending = [s(0, 0, 1), s(1, 128, 1), s(100, 10, 2), s(200, 20, 3), s(201, 150, 3), s(202, 60, 4)];
  sc.sort(Infinity);
  check('Coincidence sorter', sc.counts.trues === 1 && sc.counts.multiples === 1 && sc.counts.prompts === 1,
    `trues ${sc.counts.trues}, multiples ${sc.counts.multiples}`);
}

// 7. Randoms grow with activity (rate ∝ A², so the randoms fraction ∝ A).
{
  const frac = A => {const sc = new Scanner(PHANTOMS.uniform.make(), {activity: A}, 7); sc.acquire(60000); return sc.counts.randoms / sc.counts.decays;};
  const f1 = frac(4e6), f2 = frac(2e7), ratio = f2 / f1;
  check('Randoms scale with activity', ratio > 3.5 && ratio < 6.5, `randoms per decay ×${ratio.toFixed(2)} for activity ×5 (expect ≈5)`);
}

// 8. Reconstruction of point sources in air: FBP positions, MLEM count conservation, TOF centring.
{
  const sc = new Scanner(PHANTOMS.points.make(), {timingResolution: 100}, 8), rec = new Reconstructor();
  sc.onCoincidence = ev => rec.add(ev);
  for (let i = 0; i < 40; i++) sc.acquire(5000);
  const img = rec.filteredBackprojection(false), n = rec.nPix;
  const centroid = (x0, y0, w, image) => {
    let sx = 0, sy = 0, sw = 0;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const x = -rec.fov + (ix + 0.5) * rec.pix, y = rec.fov - (iy + 0.5) * rec.pix;
      if (Math.hypot(x - x0, y - y0) > w) continue; const v = image[iy * n + ix]; sx += v * x; sy += v * y; sw += v;
    }
    return [sx / sw, sy / sw];
  };
  for (const x0 of [0, 5, 10]) {
    const [cx, cy] = centroid(x0, 0, 1.5, img);
    check(`FBP point source at (${x0}, 0)`, Math.hypot(cx - x0, cy) < rec.pix, `centroid (${cx.toFixed(3)}, ${cy.toFixed(3)}) cm`);
  }
  rec.mlem(false, 5);
  const proj = rec.forwardProject(rec.mlemImage);
  let sp = 0, sy = 0; for (let i = 0; i < proj.length; i++) {sp += proj[i]; sy += rec.sino[i];}
  check('MLEM preserves total counts', Math.abs(sp / sy - 1) < 1e-6, `Σ A·x / Σ y = ${(sp / sy).toFixed(9)}`);
  const tof = rec.tofBackprojection(false, 100), [tx, ty] = centroid(5, 0, 3, tof);
  check('TOF places events at the source', Math.hypot(tx - 5, ty) < 0.5, `centroid (${tx.toFixed(3)}, ${ty.toFixed(3)}) cm`);
}

// 9. Reproducible: same seed, same acquisition.
{
  const run = () => {const sc = new Scanner(PHANTOMS.torso.make(), {}, 11); sc.acquire(20000); return JSON.stringify(sc.counts);};
  check('Seeded acquisition is reproducible', run() === run(), 'identical counters');
}

// 10. Layering rule: no DOM inside engine/ or recon/.
{
  const bad = [];
  for (const dir of ['engine', 'recon']) for (const f of readdirSync(dir))
    if (/\b(document|window)\.|getContext\(|HTMLElement/.test(readFileSync(`${dir}/${f}`, 'utf8'))) bad.push(`${dir}/${f}`);
  check('No DOM in engine/ or recon/', bad.length === 0, bad.join(', ') || 'clean');
}

console.table(results);
console.log(`PASS: ${results.length} checks`);
