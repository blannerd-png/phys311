// 511 keV photon transport in 3D. Photons are not Newtonian bodies: they travel in straight
// lines at c. MUST model: no scattering, only (optional) straight-line attenuation, i.e. a
// photon either reaches the detector along its original line or is removed (Beer–Lambert).
// COULD model (scatter on): Compton scattering sampled from Klein–Nishina with Woodcock
// (delta) tracking through the heterogeneous phantom. Lengths in cm, energies in keV.
import {exponential} from './random.js';
import {ME_KEV} from './annihilation.js';

export const C_CM_PER_NS = 29.9792458;

// Total Klein–Nishina cross-section, up to a constant factor.
function sigmaKN(E) {
  const k = E / ME_KEV, a = 1 + 2 * k, l = Math.log(a);
  return (1 + k) / (k * k) * (2 * (1 + k) / a - l / k) + l / (2 * k) - (1 + 3 * k) / (a * a);
}
const SIGMA_511 = sigmaKN(ME_KEV);
// In soft tissue at PET energies attenuation is almost entirely Compton, so mu(E) ∝ σ_KN(E).
export function muScale(E) {return sigmaKN(Math.max(E, 1)) / SIGMA_511;}

// Scattered photon energy (Compton formula).
export function comptonEnergy(E, cosTheta) {return E / (1 + (E / ME_KEV) * (1 - cosTheta));}

// Sample cos θ from the Klein–Nishina differential cross-section by rejection.
export function sampleKleinNishina(rand, E) {
  const k = E / ME_KEV;
  for (;;) {
    const c = 2 * rand() - 1, P = 1 / (1 + k * (1 - c));
    const f = P * P * (P + 1 / P - (1 - c * c));   // ≤ 2 for all angles
    if (2 * rand() < f) return c;
  }
}

// Distance along the unit 3D direction d from p to the cylinder surface x²+y² = R² (axis = z),
// going outwards. null if the ray is parallel to the axis or misses.
export function rayCylinderExit(p, d, cx, cy, R) {
  const ox = p[0] - cx, oy = p[1] - cy, a = d[0] * d[0] + d[1] * d[1];
  if (a < 1e-14) return null;
  const b = ox * d[0] + oy * d[1], q = ox * ox + oy * oy - R * R, disc = b * b - a * q;
  if (disc < 0) return null;
  const t = (-b + Math.sqrt(disc)) / a;
  return t >= 0 ? t : null;
}

// Distance to leave the body (outer region) of the phantom; 0 if already outside.
function bodyExit(phantom, p, d) {
  const b = phantom.body;
  if (b.shape === 'sphere') {
    const o = [p[0] - b.x, p[1] - b.y, p[2] - b.z], bb = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    const disc = bb * bb - (o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - b.r * b.r);
    return disc < 0 ? 0 : Math.max(0, -bb + Math.sqrt(disc));
  }
  let t = rayCylinderExit(p, d, b.x, b.y, b.r) ?? Infinity;
  if (d[2] > 1e-14) t = Math.min(t, (b.z1 - p[2]) / d[2]);
  else if (d[2] < -1e-14) t = Math.min(t, (b.z0 - p[2]) / d[2]);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

// Rotate unit vector d by polar angle θ (cos c) about a random azimuth (3D Compton scatter).
function deflect(d, c, rand) {
  const s = Math.sqrt(Math.max(0, 1 - c * c)), phi = 2 * Math.PI * rand(), cp = Math.cos(phi), sp = Math.sin(phi);
  const [u, v, w] = d;
  if (Math.abs(w) > 0.99999) return [s * cp, s * sp, Math.sign(w) * c];
  const k = Math.sqrt(1 - w * w);
  return [
    u * c + s * (u * w * cp - v * sp) / k,
    v * c + s * (v * w * cp + u * sp) / k,
    w * c - s * cp * k
  ];
}

// Follow one photon from the annihilation point p (patient frame) along unit direction d
// to the detector cylinder of radius det.R, which covers det.zLo ≤ z ≤ det.zHi (patient frame).
// Returns {absorbed, escaped, x, y, z, angle, length, scatters, E, path}.
export function transportPhoton(rand, phantom, p, d, E, det, {attenuation = true, scatter = false, record = false} = {}) {
  const path = record ? [[...p]] : null;
  let pos = [...p], dir = [...d], length = 0, scatters = 0;
  if (attenuation && phantom.muMax > 0) {
    if (!scatter) {
      // Straight line: survival probability exp(−∫mu dl) along the whole line out of the body.
      const t = bodyExit(phantom, pos, dir);
      const end = [pos[0] + dir[0] * t, pos[1] + dir[1] * t, pos[2] + dir[2] * t];
      const mul = phantom.muLineIntegral(pos, end) * muScale(E);
      if (rand() >= Math.exp(-mul)) {
        // Removed somewhere along the line; for the drawing, put the interaction at a sampled depth.
        if (record) path.push(end.map((v, i) => pos[i] + (v - pos[i]) * rand()));
        return {absorbed: true, escaped: false, path, length, scatters, E, x: pos[0], y: pos[1], z: pos[2]};
      }
    } else {
      for (let guard = 0; guard < 400; guard++) {
        const exit = bodyExit(phantom, pos, dir);
        if (exit <= 0) break;
        const muMax = phantom.muMax * muScale(E);
        const s = exponential(rand, muMax);
        if (s >= exit) {pos = pos.map((v, i) => v + dir[i] * exit); length += exit; break;}
        pos = pos.map((v, i) => v + dir[i] * s); length += s;
        const mu = phantom.muAt(pos[0], pos[1], pos[2]) * muScale(E);
        if (rand() * muMax >= mu) continue;          // virtual (delta) collision: keep going
        const c = sampleKleinNishina(rand, E);
        dir = deflect(dir, c, rand); E = comptonEnergy(E, c); scatters++;
        if (record) path.push([...pos]);
        if (E < 20) return {absorbed: true, escaped: false, path, length, scatters, E, x: pos[0], y: pos[1], z: pos[2]}; // photoelectric
      }
    }
  }
  const toRing = rayCylinderExit(pos, dir, 0, 0, det.R);
  if (toRing === null) return {absorbed: false, escaped: true, path, length, scatters, E, x: pos[0], y: pos[1], z: pos[2]};
  pos = pos.map((v, i) => v + dir[i] * toRing); length += toRing;
  if (record) path.push([...pos]);
  const escaped = pos[2] < det.zLo || pos[2] > det.zHi;   // passes the end of the ring stack
  return {absorbed: false, escaped, path, length, scatters, E, x: pos[0], y: pos[1], z: pos[2], angle: Math.atan2(pos[1], pos[0])};
}

// Where would an unscattered photon from p along d hit the detector cylinder? (fast pre-check)
export function straightHitZ(p, d, R) {
  const t = rayCylinderExit(p, d, 0, 0, R);
  return t === null ? null : p[2] + d[2] * t;
}
