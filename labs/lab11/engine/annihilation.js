// e+ e− annihilation into two photons with exact relativistic kinematics, in 3D.
// Units: energy and momentum in keV (c = 1). Directions are unit 3-vectors [x, y, z].
import {gaussian} from './random.js';

export const ME_KEV = 511;
// The pair's residual momentum makes the photons deviate from 180°. A momentum spread of
// 1.9 keV/c per Cartesian component gives the measured ≈0.5° FWHM angular deviation
// (projected onto one plane), as in water.
export const SIGMA_PC_KEV = 1.9;

// Isotropic unit vector in 3D (uniform on the sphere).
export function isotropic(rand) {
  const cz = 2 * rand() - 1, sz = Math.sqrt(1 - cz * cz), a = 2 * Math.PI * rand();
  return [sz * Math.cos(a), sz * Math.sin(a), cz];
}

// `n` (optional) is the photon axis in the pair rest frame, if the caller has already sampled it.
export function annihilate(rand, {nonCollinearity = true, sigmaPc = SIGMA_PC_KEV} = {}, n = isotropic(rand)) {
  const M = 2 * ME_KEV, half = M / 2;          // invariant mass of the pair; 511 keV per photon at rest
  let Px = 0, Py = 0, Pz = 0;
  if (nonCollinearity) {Px = sigmaPc * gaussian(rand); Py = sigmaPc * gaussian(rand); Pz = sigmaPc * gaussian(rand);}
  const p = Math.sqrt(Px * Px + Py * Py + Pz * Pz), E = Math.sqrt(M * M + p * p);   // total energy of the moving pair
  const photons = [];
  for (const sgn of [1, -1]) {
    const kx = sgn * half * n[0], ky = sgn * half * n[1], kz = sgn * half * n[2];
    if (p === 0) {photons.push({E: half, p: [kx, ky, kz], dir: [sgn * n[0], sgn * n[1], sgn * n[2]]}); continue;}
    // Lorentz boost from the pair rest frame to the lab along u = P/|P|.
    const ux = Px / p, uy = Py / p, uz = Pz / p, beta = p / E, gamma = E / M;
    const along = kx * ux + ky * uy + kz * uz;
    const El = gamma * (half + beta * along);
    const extra = (gamma - 1) * along + gamma * beta * half;
    const lx = kx + extra * ux, ly = ky + extra * uy, lz = kz + extra * uz, L = Math.sqrt(lx * lx + ly * ly + lz * lz);
    photons.push({E: El, p: [lx, ly, lz], dir: [lx / L, ly / L, lz / L]});
  }
  const [a, b] = photons;
  const cosAng = a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2];
  return {
    photons,
    residual: {p: [Px, Py, Pz], E},
    // Total deviation from perfectly back-to-back emission, in degrees.
    deviationDeg: (Math.PI - Math.acos(Math.max(-1, Math.min(1, cosAng)))) * 180 / Math.PI,
    // Conservation checks: should be ~1e-13.
    energyError: a.E + b.E - E,
    momentumError: Math.hypot(a.p[0] + b.p[0] - Px, a.p[1] + b.p[1] - Py, a.p[2] + b.p[2] - Pz)
  };
}
