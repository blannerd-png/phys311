// e+ e− annihilation into two photons with exact relativistic kinematics.
// Units: energy and momentum in keV (c = 1).
import {gaussian} from './random.js';

export const ME_KEV = 511;
// The pair's residual momentum makes the photons deviate from 180°. A transverse
// momentum spread of 1.9 keV/c gives the measured ≈0.5° FWHM non-collinearity in water.
export const SIGMA_PC_KEV = 1.9;

export function annihilate(rand, {nonCollinearity = true, sigmaPc = SIGMA_PC_KEV} = {}) {
  const M = 2 * ME_KEV;                       // invariant mass of the pair (at rest ≈ 1022 keV)
  const px = nonCollinearity ? sigmaPc * gaussian(rand) : 0;
  const py = nonCollinearity ? sigmaPc * gaussian(rand) : 0;
  const p = Math.hypot(px, py), E = Math.hypot(M, p);  // total energy of the moving pair
  const theta = 2 * Math.PI * rand();
  const half = M / 2;                          // each photon has 511 keV in the pair's rest frame
  const cmDirs = [[Math.cos(theta), Math.sin(theta)], [-Math.cos(theta), -Math.sin(theta)]];
  const photons = cmDirs.map(([nx, ny]) => {
    if (p === 0) return {E: half, px: half * nx, py: half * ny, dir: [nx, ny]};
    // Lorentz boost from the pair rest frame to the lab frame along u = p/|p|.
    const ux = px / p, uy = py / p, beta = p / E, gamma = E / M;
    const kx = half * nx, ky = half * ny, along = kx * ux + ky * uy;
    const El = gamma * (half + beta * along);
    const extra = (gamma - 1) * along + gamma * beta * half;
    const lx = kx + extra * ux, ly = ky + extra * uy, L = Math.hypot(lx, ly);
    return {E: El, px: lx, py: ly, dir: [lx / L, ly / L]};
  });
  const [a, b] = photons;
  const cosAng = a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1];
  return {
    photons,
    residual: {px, py, E},
    // Deviation from perfectly back-to-back emission, in degrees.
    deviationDeg: (Math.PI - Math.acos(Math.max(-1, Math.min(1, cosAng)))) * 180 / Math.PI,
    // Conservation checks: should be ~1e-13.
    energyError: a.E + b.E - E,
    momentumError: Math.hypot(a.px + b.px - px, a.py + b.py - py)
  };
}
