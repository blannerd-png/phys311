// 511 keV photon transport: straight rays (photons are not Newtonian bodies),
// Compton scattering sampled from Klein–Nishina, and Woodcock (delta) tracking
// through the heterogeneous phantom. Lengths in cm, energies in keV.
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

// Distance along (dx,dy) from (x,y) to where the ray leaves the circle (cx,cy,R); null if it misses.
export function rayCircleExit(x, y, dx, dy, cx, cy, R) {
  const ox = x - cx, oy = y - cy, b = ox * dx + oy * dy, q = ox * ox + oy * oy - R * R;
  const disc = b * b - q;
  if (disc < 0) return null;
  const t = -b + Math.sqrt(disc);
  return t >= 0 ? t : null;
}

// Follow one photon from the annihilation point to the detector ring.
export function transportPhoton(rand, phantom, x, y, dx, dy, E, ringRadius,
  {attenuation = true, scatter = true, record = false} = {}) {
  const path = record ? [[x, y]] : null;
  let length = 0, scatters = 0;
  const body = phantom.body;
  if (attenuation && phantom.muMax > 0) {
    for (let guard = 0; guard < 400; guard++) {
      const exit = rayCircleExit(x, y, dx, dy, body.x, body.y, body.r);
      if (exit === null) break;
      const muMax = phantom.muMax * muScale(E);
      const s = exponential(rand, muMax);
      if (s >= exit) {x += dx * exit; y += dy * exit; length += exit; break;}
      x += dx * s; y += dy * s; length += s;
      const mu = phantom.muAt(x, y) * muScale(E);
      if (rand() * muMax >= mu) continue;          // virtual (delta) collision: keep going
      if (!scatter) {                               // treated as removed from the beam
        if (record) path.push([x, y]);
        return {absorbed: true, path, length, scatters, E, x, y};
      }
      const c = sampleKleinNishina(rand, E);
      const sn = Math.sqrt(Math.max(0, 1 - c * c)) * (rand() < 0.5 ? -1 : 1); // 2D: scatter in-plane
      const ndx = dx * c - dy * sn, ndy = dx * sn + dy * c;
      dx = ndx; dy = ndy; E = comptonEnergy(E, c); scatters++;
      if (record) path.push([x, y]);
      if (E < 20) return {absorbed: true, path, length, scatters, E, x, y}; // photoelectric takes over
    }
  }
  const toRing = rayCircleExit(x, y, dx, dy, 0, 0, ringRadius);
  x += dx * toRing; y += dy * toRing; length += toRing;
  if (record) path.push([x, y]);
  return {absorbed: false, path, length, scatters, E, x, y, angle: Math.atan2(y, x)};
}
