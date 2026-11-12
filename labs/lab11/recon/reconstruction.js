// Image reconstruction for the 3D ring-stack scanner. No DOM here.
//
// Every coincidence is a line of response (LOR) between two crystals. We use single-slice
// rebinning (SSRB): an LOR is assigned to the transverse slice at the axial midpoint of its two
// crystals, z = (z1 + z2)/2 (patient frame, i.e. including the bed offset). Each slice then has an
// ordinary 2D sinogram (φ, s), reconstructed with
//   • FBP   – filtered backprojection (Shepp–Logan ramp filter), fast, linear;
//   • MLEM  – maximum-likelihood expectation maximisation on the sinogram;
//   • TOF   – the measured Δt places the annihilation at c·Δt/2 from the LOR centre with a Gaussian
//             uncertainty σ = c·σ_t/2, used either in a plain TOF backprojection or in list-mode MLEM.
// Attenuation correction (AC) uses the known μ-map of the phantom (the "CT" in PET/CT).
import {rng} from '../engine/random.js';

const C_CM_PER_NS = 29.9792458;

export class Reconstructor {
  constructor({fov = 14, nPix = 96, nAngles = 128, nS = 96, seed = 99} = {}) {
    this.fov = fov; this.nPix = nPix; this.pix = 2 * fov / nPix;
    this.nAngles = nAngles; this.nS = nS; this.ds = 2 * fov / nS;
    this.rand = rng(seed);
    this.cos = new Float64Array(nAngles); this.sin = new Float64Array(nAngles);
    for (let a = 0; a < nAngles; a++) {const p = (a + 0.5) * Math.PI / nAngles; this.cos[a] = Math.cos(p); this.sin[a] = Math.sin(p);}
    this.filterKernel = sheppLoganKernel(nS, this.ds);
    this.geom = {ringRadius: 40, crystals: 512, ringPitch: 0.5, rings: 24, maxRingDiff: 23, beds: [0]};
    this.phantom = null;
    this.smoothFWHM = 0.6;          // cm, post-filter for FBP/TOF images
    this.mlemIterations = 0; this.mlemImage = null;
    this.setAxial({z0: -6, dz: 0.5, nSlices: 24});
  }

  // Scanner geometry (crystal size for detector blur, rings and beds for slice sensitivity).
  setGeometry({ringRadius, crystals, ringPitch, rings, maxRingDiff}, beds = [0]) {
    this.geom = {ringRadius, crystals, ringPitch, rings, maxRingDiff, beds: [...beds]};
    this.computeSliceSensitivity();
  }

  // Axial grid of reconstructed slices (patient frame): slice k covers [z0 + k·dz, z0 + (k+1)·dz).
  setAxial({z0, dz, nSlices}) {
    this.z0 = z0; this.dz = dz; this.nSlices = nSlices;
    this.viewSlice = Math.min(this.viewSlice ?? Math.floor(nSlices / 2), nSlices - 1);
    this.clear();
    this.computeSliceSensitivity();
  }
  sliceZ(k) {return this.z0 + (k + 0.5) * this.dz;}
  sliceOf(z) {return Math.floor((z - this.z0) / this.dz);}
  setViewZ(z) {this.viewSlice = Math.max(0, Math.min(this.nSlices - 1, this.sliceOf(z))); this.mlemImage = null;}

  setAttenuationFromPhantom(phantom) {this.phantom = phantom; this.acCache = new Map();}

  clear() {
    const n = this.nAngles * this.nS * this.nSlices;
    this.sinos = new Float32Array(n);          // raw counts
    this.sinosAC = new Float32Array(n);        // counts weighted by the attenuation correction factor
    this.lm = Array.from({length: this.nSlices}, () => new ListMode());
    this.count = 0; this.inSlices = 0;
    this.mlemImage = null; this.mlemIterations = 0;
  }

  // How many ring pairs (summed over bed positions) feed each slice: used to normalise the axial
  // profile, which otherwise peaks in the middle of the scanner (more oblique LORs there).
  computeSliceSensitivity() {
    if (!this.geom || this.nSlices === undefined) return;
    const g = this.geom, sens = new Float32Array(this.nSlices), L = g.rings * g.ringPitch;
    for (const bed of g.beds) for (let r1 = 0; r1 < g.rings; r1++) for (let r2 = 0; r2 < g.rings; r2++) {
      if (Math.abs(r1 - r2) > g.maxRingDiff) continue;
      const z = -L / 2 + ((r1 + r2) / 2 + 0.5) * g.ringPitch + bed, k = this.sliceOf(z);
      if (k >= 0 && k < this.nSlices) sens[k]++;
    }
    this.sliceSens = sens;
  }

  // Bin one coincidence event (from Scanner.record).
  add(ev) {
    this.count++;
    const g = this.geom, R = g.ringRadius, bed = ev.bed ?? 0;
    // Detector blur: the photon hit somewhere inside the crystal, not exactly at its centre.
    const dA = 2 * Math.PI / g.crystals, r = this.rand;
    const a1 = Math.atan2(ev.y1, ev.x1) + (r() - 0.5) * dA, a2 = Math.atan2(ev.y2, ev.x2) + (r() - 0.5) * dA;
    const x1 = R * Math.cos(a1), y1 = R * Math.sin(a1), x2 = R * Math.cos(a2), y2 = R * Math.sin(a2);
    const z1 = ev.z1 + bed + (r() - 0.5) * g.ringPitch, z2 = ev.z2 + bed + (r() - 0.5) * g.ringPitch;
    const k = this.sliceOf((z1 + z2) / 2);
    if (k < 0 || k >= this.nSlices) return;
    // Sinogram coordinates: normal n = (cos φ, sin φ), φ ∈ [0, π), signed distance s = n·P.
    let ux = x2 - x1, uy = y2 - y1;
    const L2 = Math.hypot(ux, uy); ux /= L2; uy /= L2;
    let nx = -uy, ny = ux;
    if (ny < 0 || (ny === 0 && nx < 0)) {nx = -nx; ny = -ny;}
    const phi = Math.atan2(ny, nx), s = nx * x1 + ny * y1;
    const ia = Math.min(this.nAngles - 1, Math.floor(phi / Math.PI * this.nAngles));
    const is = Math.floor((s + this.fov) / this.ds);
    if (is < 0 || is >= this.nS) return;
    let acf = 1;
    if (this.phantom) acf = Math.exp(this.phantom.muLineIntegral([x1, y1, z1], [x2, y2, z2]));
    const off = (k * this.nAngles + ia) * this.nS + is;
    this.sinos[off] += 1; this.sinosAC[off] += acf;
    this.inSlices++;
    // TOF: estimated annihilation point, c·Δt/2 from the LOR midpoint towards crystal 1 (first hit).
    const L3 = Math.hypot(x2 - x1, y2 - y1, z2 - z1), shift = C_CM_PER_NS * (ev.dt ?? 0) / 2;
    const f = 0.5 - shift / L3;                       // fraction of the way from 1 to 2
    const ex = x1 + f * (x2 - x1), ey = y1 + f * (y2 - y1);
    // Position along the in-plane direction u' = (−sin φ, cos φ) relative to the point s·n.
    const tc = (ex - s * nx) * -ny + (ey - s * ny) * nx;
    this.lm[k].push(phi, s, tc, acf);
  }

  // Sinogram of slice k (or the sum of slices k0..k1).
  sinoSlab(k0, k1 = k0, useAC = false) {
    const n = this.nAngles * this.nS, out = new Float32Array(n), src = useAC ? this.sinosAC : this.sinos;
    for (let k = Math.max(0, k0); k <= Math.min(this.nSlices - 1, k1); k++) {
      const o = k * n;
      for (let i = 0; i < n; i++) out[i] += src[o + i];
    }
    return out;
  }
  get sino() {return this.sinos.subarray(this.viewSlice * this.nAngles * this.nS, (this.viewSlice + 1) * this.nAngles * this.nS);}

  reconstruct(mode, {useAC = true, ctrPs = 400, mlemIterations = 2} = {}) {
    const k = this.viewSlice;
    if (mode === 'bp') return this.backprojectSino(this.sinoSlab(k, k, useAC), false);
    if (mode === 'mlem') {this.mlemIterations = mlemIterations; return this.mlemSlab(useAC, mlemIterations, k, k);}
    if (mode === 'tof') return this.tofBackprojection(useAC, ctrPs, k);
    if (mode === 'tofmlem') return this.listModeMLEM(useAC, ctrPs, 6, [k], true);
    return this.filteredBackprojection(useAC, k);
  }

  // ---- FBP -----------------------------------------------------------------------------------
  filteredBackprojection(useAC = false, k = this.viewSlice) {return this.fbpFromSino(this.sinoSlab(k, k, useAC));}
  fbpFromSino(sino) {
    const nA = this.nAngles, nS = this.nS, h = this.filterKernel, f = new Float32Array(sino.length);
    for (let a = 0; a < nA; a++) {
      const row = a * nS;
      for (let i = 0; i < nS; i++) {
        let acc = 0;
        for (let j = 0; j < nS; j++) acc += sino[row + j] * h[Math.abs(i - j)];
        f[row + i] = acc * this.ds;
      }
    }
    const img = this.backprojectSino(f, true);
    return this.smoothFWHM > 0 ? gaussianSmooth(img, this.nPix, this.smoothFWHM / this.pix) : img;
  }

  // Pixel-driven backprojection with linear interpolation in s.
  backprojectSino(sino, scale = false) {
    const n = this.nPix, img = new Float32Array(n * n), nS = this.nS;
    for (let a = 0; a < this.nAngles; a++) {
      const c = this.cos[a], sn = this.sin[a], row = a * nS;
      for (let iy = 0; iy < n; iy++) {
        const y = this.fov - (iy + 0.5) * this.pix;
        for (let ix = 0; ix < n; ix++) {
          const x = -this.fov + (ix + 0.5) * this.pix;
          const u = (x * c + y * sn + this.fov) / this.ds - 0.5, i0 = Math.floor(u), w = u - i0;
          if (i0 < 0 || i0 >= nS - 1) continue;
          img[iy * n + ix] += sino[row + i0] * (1 - w) + sino[row + i0 + 1] * w;
        }
      }
    }
    if (scale) for (let i = 0; i < img.length; i++) img[i] *= Math.PI / this.nAngles;
    return img;
  }

  // ---- Ray-driven projector (for MLEM) --------------------------------------------------------
  // Calls visit(pixelIndex, weight) for the bilinear footprint of points along LOR (φ_a, s).
  // If tc/sigma are given, weights are multiplied by the TOF Gaussian kernel centred at tc.
  traceLOR(c, sn, s, visit, tc = null, sigma = 0) {
    const n = this.nPix, fov = this.fov, h = this.pix / 2;
    if (Math.abs(s) >= fov) return;
    let T = Math.sqrt(fov * fov - s * s), t0 = -T, t1 = T;
    let norm = 0;
    if (tc !== null) {
      t0 = Math.max(t0, tc - 3 * sigma); t1 = Math.min(t1, tc + 3 * sigma);
      if (t1 <= t0) return;
      norm = h / (Math.sqrt(2 * Math.PI) * sigma);
    }
    const ux = -sn, uy = c, px = s * c, py = s * sn;
    for (let t = t0 + h / 2; t < t1; t += h) {
      const x = px + t * ux, y = py + t * uy;
      const fx = (x + fov) / this.pix - 0.5, fy = (fov - y) / this.pix - 0.5;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix >= n - 1 || iy >= n - 1) continue;
      const wx = fx - ix, wy = fy - iy;
      const w = tc === null ? h : norm * Math.exp(-0.5 * ((t - tc) / sigma) ** 2);
      const p = iy * n + ix;
      visit(p, w * (1 - wx) * (1 - wy)); visit(p + 1, w * wx * (1 - wy));
      visit(p + n, w * (1 - wx) * wy); visit(p + n + 1, w * wx * wy);
    }
  }

  // Sinogram forward projection A·x and its transpose Aᵀ·y (same ray samples as traceLOR,
  // written out inline because they run in the hot loop of MLEM).
  forwardProject(img, attenuation = null) {return this.projectRays(img, null, attenuation);}
  backProjectRay(sino) {return this.projectRays(null, sino, null);}
  projectRays(img, sino, attenuation) {
    const nA = this.nAngles, nS = this.nS, n = this.nPix, fov = this.fov, pix = this.pix, h = pix / 2;
    const forward = img !== null, out = forward ? new Float32Array(nA * nS) : new Float32Array(n * n);
    for (let a = 0; a < nA; a++) {
      const c = this.cos[a], sn = this.sin[a], ux = -sn, uy = c;
      for (let i = 0; i < nS; i++) {
        const s = -fov + (i + 0.5) * this.ds;
        if (Math.abs(s) >= fov) continue;
        const v = forward ? 0 : sino[a * nS + i];
        if (!forward && v === 0) continue;
        const T = Math.sqrt(fov * fov - s * s), px = s * c, py = s * sn;
        let acc = 0;
        for (let t = -T + h / 2; t < T; t += h) {
          const fx = (px + t * ux + fov) / pix - 0.5, fy = (fov - py - t * uy) / pix - 0.5;
          const ix = Math.floor(fx), iy = Math.floor(fy);
          if (ix < 0 || iy < 0 || ix >= n - 1 || iy >= n - 1) continue;
          const wx = fx - ix, wy = fy - iy, p = iy * n + ix;
          const w00 = (1 - wx) * (1 - wy), w10 = wx * (1 - wy), w01 = (1 - wx) * wy, w11 = wx * wy;
          if (forward) acc += img[p] * w00 + img[p + 1] * w10 + img[p + n] * w01 + img[p + n + 1] * w11;
          else {const q = v * h; out[p] += q * w00; out[p + 1] += q * w10; out[p + n] += q * w01; out[p + n + 1] += q * w11;}
        }
        if (forward) out[a * nS + i] = attenuation ? acc * h * attenuation[a * nS + i] : acc * h;
      }
    }
    return out;
  }

  // Attenuation factors exp(−∫μ) per sinogram bin for slice k (direct-plane approximation).
  attenuationFactors(k) {
    if (!this.phantom) return null;
    const key = `${k}:${this.sliceZ(k)}`;
    if (this.acCache?.has(key)) return this.acCache.get(key);
    const nA = this.nAngles, nS = this.nS, a = new Float32Array(nA * nS), z = this.sliceZ(k);
    for (let ia = 0; ia < nA; ia++) for (let i = 0; i < nS; i++)
      a[ia * nS + i] = Math.exp(-this.phantom.lineIntegralMu((ia + 0.5) * Math.PI / nA, -this.fov + (i + 0.5) * this.ds, z));
    this.acCache?.set(key, a);
    return a;
  }

  // Pixels inside the reconstructable circle (radius fov − 2 pixels) and with usable sensitivity.
  fovMask(sens) {
    const n = this.nPix, m = new Uint8Array(n * n), rMax = this.fov - 2 * this.pix;
    let smax = 0; for (let i = 0; i < sens.length; i++) smax = Math.max(smax, sens[i]);
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const x = -this.fov + (ix + 0.5) * this.pix, y = this.fov - (iy + 0.5) * this.pix, i = iy * n + ix;
      m[i] = x * x + y * y <= rMax * rMax && sens[i] > 0.02 * smax ? 1 : 0;
    }
    return m;
  }

  // Sinogram MLEM: x ← x / (Aᵀa) · Aᵀ( y / (A x) ), with a = attenuation factors when useAC.
  mlem(useAC = false, iterations = 10, k = this.viewSlice, continueFrom = false) {
    const y = this.sinoSlab(k, k, false), n2 = this.nPix ** 2;
    const att = useAC ? this.attenuationFactors(k) : null;
    const sens = this.backProjectRay(att ?? new Float32Array(y.length).fill(1)), mask = this.fovMask(sens);
    let x = continueFrom && this.mlemImage && this.mlemKey === `${k}:${useAC}` ? this.mlemImage : null;
    if (!x) {x = new Float32Array(n2); for (let i = 0; i < n2; i++) x[i] = mask[i]; this.mlemIterations = 0;}
    for (let it = 0; it < iterations; it++) {
      const ax = this.forwardProject(x);
      const ratio = new Float32Array(y.length);
      for (let i = 0; i < y.length; i++) ratio[i] = ax[i] > 0 ? y[i] / ax[i] : 0;
      const bp = this.backProjectRay(ratio);
      for (let j = 0; j < n2; j++) x[j] = mask[j] ? x[j] * bp[j] / sens[j] : 0;
      this.mlemIterations++;
    }
    this.mlemImage = x; this.mlemKey = `${k}:${useAC}`;
    return x;
  }

  // Sinogram MLEM on the sum of slices k0..k1 (used for the live detectability readout).
  mlemSlab(useAC, iterations, k0, k1) {
    const y = this.sinoSlab(k0, k1, false), n2 = this.nPix ** 2;
    let att = null;
    if (useAC && this.phantom) {
      att = new Float32Array(y.length); const m = k1 - k0 + 1;
      for (let k = k0; k <= k1; k++) {const a = this.attenuationFactors(k); for (let i = 0; i < a.length; i++) att[i] += a[i] / m;}
    }
    const sens = this.backProjectRay(att ?? new Float32Array(y.length).fill(1)), mask = this.fovMask(sens);
    const x = new Float32Array(n2); for (let i = 0; i < n2; i++) x[i] = mask[i];
    for (let it = 0; it < iterations; it++) {
      const ax = this.forwardProject(x), ratio = new Float32Array(y.length);
      for (let i = 0; i < y.length; i++) ratio[i] = ax[i] > 0 ? y[i] / ax[i] : 0;
      const bp = this.backProjectRay(ratio);
      for (let j = 0; j < n2; j++) x[j] = mask[j] ? x[j] * bp[j] / sens[j] : 0;
    }
    return this.smoothFWHM > 0 ? gaussianSmooth(x, this.nPix, this.smoothFWHM / this.pix) : x;
  }

  // ---- TOF -----------------------------------------------------------------------------------
  tofSigma(ctrPs) {return C_CM_PER_NS * (ctrPs / 1000) / 2 / 2.355;}   // cm, along the LOR

  // Plain TOF backprojection: each event is spread along its LOR with the TOF Gaussian.
  tofBackprojection(useAC = false, ctrPs = 400, k = this.viewSlice) {
    const lm = this.lm[k], img = new Float32Array(this.nPix ** 2), sigma = this.tofSigma(ctrPs);
    for (let e = 0; e < lm.n; e++) {
      const phi = lm.phi[e], w0 = useAC ? lm.acf[e] : 1;
      this.traceLOR(Math.cos(phi), Math.sin(phi), lm.s[e], (p, w) => {img[p] += w * w0;}, lm.tc[e], sigma);
    }
    return this.smoothFWHM > 0 ? gaussianSmooth(img, this.nPix, this.smoothFWHM / this.pix) : img;
  }

  // List-mode MLEM on slices `ks` (summed), with (tof = true) or without the TOF kernel.
  // x ← x / (Aᵀa) · Σ_events A_e / (A_e x). Returns a post-smoothed copy; the raw image is in lmImage.
  listModeMLEM(useAC = false, ctrPs = 400, iterations = 6, ks = [this.viewSlice], tof = true) {
    const n2 = this.nPix ** 2, sigma = this.tofSigma(ctrPs);
    let att = null;
    if (useAC) {att = new Float32Array(this.nAngles * this.nS); for (const k of ks) {const a = this.attenuationFactors(k); for (let i = 0; i < a.length; i++) att[i] += a[i] / ks.length;}}
    const sens = this.backProjectRay(att ?? new Float32Array(this.nAngles * this.nS).fill(1)), mask = this.fovMask(sens);
    const lists = ks.map(k => this.lm[k]);
    const x = new Float32Array(n2);
    for (let i = 0; i < n2; i++) x[i] = mask[i];
    const idx = [], wts = [];
    for (let it = 0; it < iterations; it++) {
      const bp = new Float32Array(n2);
      for (const lm of lists) for (let e = 0; e < lm.n; e++) {
        const phi = lm.phi[e];
        idx.length = 0; wts.length = 0;
        this.traceLOR(Math.cos(phi), Math.sin(phi), lm.s[e], (p, w) => {idx.push(p); wts.push(w);}, tof ? lm.tc[e] : null, sigma);
        let fp = 0;
        for (let q = 0; q < idx.length; q++) fp += x[idx[q]] * wts[q];
        if (fp <= 0) continue;
        for (let q = 0; q < idx.length; q++) bp[idx[q]] += wts[q] / fp;
      }
      for (let j = 0; j < n2; j++) x[j] = mask[j] ? x[j] * bp[j] / sens[j] : 0;
    }
    this.lmImage = x;
    return this.smoothFWHM > 0 ? gaussianSmooth(x, this.nPix, this.smoothFWHM / this.pix) : x;
  }

  // ---- Volume views ----------------------------------------------------------------------------
  // FBP of every slice; returns {data: Float32Array(nSlices·nPix²), nSlices, nPix}.
  reconstructVolume(useAC = true) {
    const n2 = this.nPix ** 2, vol = new Float32Array(this.nSlices * n2);
    const maxSens = Math.max(1, ...this.sliceSens);
    for (let k = 0; k < this.nSlices; k++) {
      if (this.sliceSens[k] < 0.15 * maxSens) continue;     // end slices: too few ring pairs to be useful
      const sino = this.sinoSlab(k, k, useAC);
      let any = false; for (let i = 0; i < sino.length; i++) if (sino[i]) {any = true; break;}
      if (!any) continue;
      const img = this.fbpFromSino(sino), norm = maxSens / this.sliceSens[k];
      for (let i = 0; i < n2; i++) vol[k * n2 + i] = img[i] * norm;
    }
    return {data: vol, nSlices: this.nSlices, nPix: this.nPix};
  }
}

// Growable list-mode storage for one slice.
class ListMode {
  constructor() {this.n = 0; this.cap = 0; this.phi = this.s = this.tc = this.acf = new Float32Array(0);}
  push(phi, s, tc, acf) {
    if (this.n === this.cap) {
      this.cap = Math.max(1024, this.cap * 2);
      for (const k of ['phi', 's', 'tc', 'acf']) {const a = new Float32Array(this.cap); a.set(this[k]); this[k] = a;}
    }
    this.phi[this.n] = phi; this.s[this.n] = s; this.tc[this.n] = tc; this.acf[this.n] = acf; this.n++;
  }
}

// Spatial Shepp–Logan kernel h[n] (ramp × sinc), for |n| = 0..N.
function sheppLoganKernel(N, d) {
  const h = new Float64Array(N + 1);
  for (let n = 0; n <= N; n++) h[n] = -2 / (Math.PI * Math.PI * d * d * (4 * n * n - 1));
  return h;
}

// Separable Gaussian smoothing with FWHM given in pixels.
export function gaussianSmooth(img, n, fwhmPix) {
  const sigma = fwhmPix / 2.355, r = Math.ceil(3 * sigma), k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {const v = Math.exp(-0.5 * (i / sigma) ** 2); k.push(v); sum += v;}
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let a = 0; for (let i = -r; i <= r; i++) {const xx = x + i; if (xx >= 0 && xx < n) a += img[y * n + xx] * k[i + r];}
    tmp[y * n + x] = a;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let a = 0; for (let i = -r; i <= r; i++) {const yy = y + i; if (yy >= 0 && yy < n) a += tmp[yy * n + x] * k[i + r];}
    out[y * n + x] = a;
  }
  return out;
}
