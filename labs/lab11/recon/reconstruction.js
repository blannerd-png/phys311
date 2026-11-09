// Image reconstruction from coincidences. Pure math (no DOM), shared by the page and the tests.
//   Sinogram: each LOR is binned by its angle φ ∈ [0, π) and signed distance s from the centre.
//   BP   — simple backprojection (blurry: every LOR smeared across the image)
//   FBP  — ramp-filtered backprojection (Hann apodised)
//   MLEM — maximum-likelihood expectation maximisation (iterative, Poisson statistics)
//   TOF  — list-mode backprojection weighted by a Gaussian at the time-of-flight position
import {C_CM_PER_NS} from '../engine/photon.js';
import {rng} from '../engine/random.js';

export class Reconstructor {
  constructor({nPix = 128, fov = 14, nAngles = 160, nS = 128, ringRadius = 40, crystals = 256} = {}) {
    Object.assign(this, {nPix, fov, nAngles, nS, ringRadius, crystals});
    this.rand = rng(99);
    this.pix = 2 * fov / nPix;
    this.ds = 2 * fov / nS;
    this.cos = new Float64Array(nAngles); this.sin = new Float64Array(nAngles);
    for (let a = 0; a < nAngles; a++) {const p = (a + 0.5) * Math.PI / nAngles; this.cos[a] = Math.cos(p); this.sin[a] = Math.sin(p);}
    // Pixel centres and the circular field-of-view mask.
    this.mask = []; this.px = []; this.py = [];
    for (let iy = 0; iy < nPix; iy++) for (let ix = 0; ix < nPix; ix++) {
      const x = -fov + (ix + 0.5) * this.pix, y = fov - (iy + 0.5) * this.pix;
      if (x * x + y * y <= fov * fov) {this.mask.push(iy * nPix + ix); this.px.push(x); this.py.push(y);}
    }
    this.attenuation = new Float64Array(nAngles * nS).fill(1); // survival probability per bin
    this.clear();
  }

  clear() {
    this.sino = new Float64Array(this.nAngles * this.nS);
    this.tof = {x1: [], y1: [], x2: [], y2: [], dt: [], bin: []};
    this.count = 0;
    this.mlemImage = null; this.mlemIterations = 0;
  }

  // exp(−∫μ dl) for every sinogram bin, from the phantom's exact line integrals.
  setAttenuationFromPhantom(phantom) {
    for (let a = 0; a < this.nAngles; a++) {
      const phi = (a + 0.5) * Math.PI / this.nAngles;
      for (let k = 0; k < this.nS; k++) {
        const s = -this.fov + (k + 0.5) * this.ds;
        this.attenuation[a * this.nS + k] = Math.exp(-phantom.lineIntegralMu(phi, s));
      }
    }
    this.mlemImage = null; this.mlemIterations = 0;
  }

  binOf(x1, y1, x2, y2) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    let nx = -(y2 - y1) / L, ny = (x2 - x1) / L;  // unit normal
    let phi = Math.atan2(ny, nx), s = nx * x1 + ny * y1;
    if (phi < 0) {phi += Math.PI; s = -s;}
    if (phi >= Math.PI) {phi -= Math.PI; s = -s;}
    const a = Math.min(this.nAngles - 1, Math.floor(phi / Math.PI * this.nAngles));
    const k = Math.floor((s + this.fov) / this.ds);
    if (k < 0 || k >= this.nS) return -1;
    return a * this.nS + k;
  }

  // The scanner only knows which crystal fired, so each LOR end is placed at a random point
  // across that crystal's face. Using crystal centres instead leaves gaps between the discrete
  // LOR offsets and produces ring/stripe artefacts in the image.
  endpoint(c) {
    const a = (c + this.rand()) * 2 * Math.PI / this.crystals;
    return [this.ringRadius * Math.cos(a), this.ringRadius * Math.sin(a)];
  }

  add(ev) {
    const [x1, y1] = ev.c1 === undefined ? [ev.x1, ev.y1] : this.endpoint(ev.c1);
    const [x2, y2] = ev.c2 === undefined ? [ev.x2, ev.y2] : this.endpoint(ev.c2);
    ev = {...ev, x1, y1, x2, y2};
    const bin = this.binOf(ev.x1, ev.y1, ev.x2, ev.y2);
    if (bin < 0) return;
    this.sino[bin]++;
    this.count++;
    const T = this.tof;
    if (T.x1.length < 400000) {T.x1.push(ev.x1); T.y1.push(ev.y1); T.x2.push(ev.x2); T.y2.push(ev.y2); T.dt.push(ev.dt); T.bin.push(bin);}
  }

  // Backproject a sinogram (linear interpolation in s). Exact transpose of forwardProject.
  backproject(sino) {
    const img = new Float64Array(this.nPix * this.nPix), {nAngles, nS, fov, ds, mask, px, py} = this;
    for (let a = 0; a < nAngles; a++) {
      const c = this.cos[a], sn = this.sin[a], row = a * nS;
      for (let m = 0; m < mask.length; m++) {
        const u = (px[m] * c + py[m] * sn + fov) / ds - 0.5, k = Math.floor(u), f = u - k;
        let v = 0;
        if (k >= 0 && k < nS) v += (1 - f) * sino[row + k];
        if (k + 1 >= 0 && k + 1 < nS) v += f * sino[row + k + 1];
        img[mask[m]] += v;
      }
    }
    return img;
  }

  forwardProject(img) {
    const sino = new Float64Array(this.nAngles * this.nS), {nAngles, nS, fov, ds, mask, px, py} = this;
    for (let a = 0; a < nAngles; a++) {
      const c = this.cos[a], sn = this.sin[a], row = a * nS;
      for (let m = 0; m < mask.length; m++) {
        const val = img[mask[m]]; if (val === 0) continue;
        const u = (px[m] * c + py[m] * sn + fov) / ds - 0.5, k = Math.floor(u), f = u - k;
        if (k >= 0 && k < nS) sino[row + k] += (1 - f) * val;
        if (k + 1 >= 0 && k + 1 < nS) sino[row + k + 1] += f * val;
      }
    }
    return sino;
  }

  corrected(useAC) {
    if (!useAC) return this.sino;
    const out = new Float64Array(this.sino.length);
    for (let i = 0; i < out.length; i++) out[i] = this.sino[i] / Math.max(this.attenuation[i], 1e-6);
    return out;
  }

  simpleBackprojection(useAC) {return this.backproject(this.corrected(useAC));}

  filteredBackprojection(useAC) {
    const sino = this.corrected(useAC), {nAngles, nS} = this;
    const N = nextPow2(2 * nS), filtered = new Float64Array(sino.length);
    // Ramp |f| with a Hann window, applied in the frequency domain.
    const H = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const f = Math.min(i, N - i) / N;           // cycles per sample, 0 … 0.5
      H[i] = f * (0.5 + 0.5 * Math.cos(Math.PI * f / 0.5));
    }
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let a = 0; a < nAngles; a++) {
      re.fill(0); im.fill(0);
      for (let k = 0; k < nS; k++) re[k] = sino[a * nS + k];
      fft(re, im, false);
      for (let i = 0; i < N; i++) {re[i] *= H[i]; im[i] *= H[i];}
      fft(re, im, true);
      for (let k = 0; k < nS; k++) filtered[a * nS + k] = re[k];
    }
    const img = this.backproject(filtered);
    for (let i = 0; i < img.length; i++) if (img[i] < 0) img[i] = 0;   // negative lobes clipped for display
    return img;
  }

  // MLEM: x ← x / Aᵀa · Aᵀ( a·y / (a·A x) ). Warm-started so the image refines while counts arrive.
  mlem(useAC, iterations = 2) {
    const a = useAC ? this.attenuation : null, y = this.sino;
    if (!this.mlemImage || this.mlemAC !== useAC) {
      this.mlemImage = new Float64Array(this.nPix * this.nPix);
      for (const m of this.mask) this.mlemImage[m] = 1;
      this.mlemIterations = 0; this.mlemAC = useAC;
      const ones = new Float64Array(y.length).fill(1);
      this.sensitivity = this.backproject(a ? a.slice() : ones);
    }
    const x = this.mlemImage, sens = this.sensitivity;
    for (let it = 0; it < iterations; it++) {
      const proj = this.forwardProject(x);
      const ratio = new Float64Array(y.length);
      for (let i = 0; i < y.length; i++) {
        const w = a ? a[i] : 1, p = w * proj[i];
        ratio[i] = p > 1e-12 ? w * y[i] / p : 0;
      }
      const back = this.backproject(ratio);
      for (const m of this.mask) x[m] = sens[m] > 1e-12 ? x[m] * back[m] / sens[m] : 0;
      this.mlemIterations++;
    }
    return x;
  }

  // List-mode TOF backprojection: each event deposits a Gaussian centred at the TOF position.
  tofBackprojection(useAC, ctrPs) {
    const img = new Float64Array(this.nPix * this.nPix), T = this.tof, {nPix, fov, pix} = this;
    const sigma = Math.max(C_CM_PER_NS * (ctrPs / 1000 / 2.355) / 2, pix / 2);  // cm along the LOR
    const step = pix / 2, reach = 3 * sigma, inv2s2 = 1 / (2 * sigma * sigma);
    for (let e = 0; e < T.x1.length; e++) {
      const x1 = T.x1[e], y1 = T.y1[e], x2 = T.x2[e], y2 = T.y2[e], L = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      // Photon 1 arrived first by dt, so the source sits c·dt/2 from the midpoint toward crystal 1.
      const off = -C_CM_PER_NS * T.dt[e] / 2;
      const cx = (x1 + x2) / 2 + ux * off, cy = (y1 + y2) / 2 + uy * off;
      const wEvent = useAC ? 1 / Math.max(this.attenuation[T.bin[e]], 1e-6) : 1;
      for (let d = -reach; d <= reach; d += step) {
        const x = cx + ux * d, y = cy + uy * d;
        const ix = Math.floor((x + fov) / pix), iy = Math.floor((fov - y) / pix);
        if (ix < 0 || iy < 0 || ix >= nPix || iy >= nPix) continue;
        img[iy * nPix + ix] += wEvent * Math.exp(-d * d * inv2s2);
      }
    }
    return img;
  }

  reconstruct(mode, {useAC = false, ctrPs = 400, mlemIterations = 2} = {}) {
    if (mode === 'fbp') return this.filteredBackprojection(useAC);
    if (mode === 'mlem') return this.mlem(useAC, mlemIterations);
    if (mode === 'tof') return this.tofBackprojection(useAC, ctrPs);
    return this.simpleBackprojection(useAC);
  }
}

function nextPow2(n) {let p = 1; while (p < n) p <<= 1; return p;}

// In-place iterative radix-2 FFT.
export function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {[re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]];}
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {re[i] /= n; im[i] /= n;}
}
