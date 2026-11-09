// Positron transport built on the Lab 9 engine: a Body integrated by World + EulerCromer,
// slowed by a Bethe-like stopping force and deflected by multiple Coulomb scattering.
// Units inside this module: length in mm, arbitrary time unit, mass 1.
import {World} from './world.js';
import {Body} from './body.js';
import {EulerCromer} from './integrators.js';
import {gaussian} from './random.js';

export const ME_MEV = 0.511;

// Mean positron range in water (mm) and beta endpoint energy (MeV).
// Ranges: Conti et al. / Cal-Gonzalez et al. tables (water). Endpoints: standard decay data.
export const ISOTOPES = {
  'F-18':  {name: 'Fluorine-18',  emax: 0.634, meanRange: 0.57, halfLife: '109.8 min', use: 'FDG: glucose metabolism'},
  'C-11':  {name: 'Carbon-11',    emax: 0.960, meanRange: 1.02, halfLife: '20.4 min',  use: 'Labelled drugs, choline'},
  'Ga-68': {name: 'Gallium-68',   emax: 1.899, meanRange: 2.69, halfLife: '67.7 min',  use: 'PSMA / DOTATATE imaging'},
  'Rb-82': {name: 'Rubidium-82',  emax: 3.378, meanRange: 5.33, halfLife: '1.3 min',   use: 'Cardiac perfusion'}
};

// Sample a beta+ kinetic energy (MeV) from the allowed phase-space shape p·E·(Emax−T)²
// (Fermi function neglected — a simplification, noted in the README).
export function makeBetaSampler(emax) {
  const shape = T => {
    const E = T + ME_MEV, p = Math.sqrt(Math.max(E * E - ME_MEV * ME_MEV, 0));
    return p * E * (emax - T) ** 2;
  };
  let peak = 0;
  for (let i = 1; i < 400; i++) peak = Math.max(peak, shape(emax * i / 400));
  peak *= 1.05;
  return rand => {
    for (;;) {
      const T = rand() * emax;
      if (rand() * peak < shape(T)) return T;
    }
  };
}

// Force: continuous slowing down. Bethe stopping power scales roughly as 1/v², so F = −b·v̂/v².
export class StoppingForce {
  constructor(b = 1) {this.b = b;}
  apply(world) {
    for (const p of world.bodies) {
      const v = p.vel.length();
      if (v > 1e-12) p.force.addScaled(p.vel, -this.b * p.m / (v * v * v));
    }
  }
}

// Force: multiple Coulomb scattering. A random kick perpendicular to v that turns the
// velocity by an rms angle sigma per step (the stopping-force step size keeps this constant,
// matching θ² ∝ path/v⁴ from Highland-type scattering).
export class ScatteringForce {
  constructor(rand, sigma = 0.35) {this.rand = rand; this.sigma = sigma; this.dt = 1;}
  apply(world) {
    for (const p of world.bodies) {
      const v = p.vel.length();
      if (v < 1e-12) continue;
      // Turn v by angle θ without changing |v|: Δv = v(cosθ−1)·v̂ + v·sinθ·n̂ over one step.
      // (A purely perpendicular kick would add energy every step.)
      const theta = this.sigma * gaussian(this.rand);
      const along = (Math.cos(theta) - 1) / this.dt, across = Math.sin(theta) / this.dt;
      p.force.x += (p.vel.x * along - p.vel.y * across) * p.m;
      p.force.y += (p.vel.y * along + p.vel.x * across) * p.m;
    }
  }
}

export class PositronTransport {
  constructor(rand, {stepFraction = 0.05, stopFraction = 0.04, sigma = 0.35} = {}) {
    this.rand = rand;
    this.eta = stepFraction;          // fractional speed loss per step
    this.stopFraction = stopFraction; // annihilate when v < stopFraction·v0max (thermalised)
    this.world = new World({integrator: new EulerCromer(), bounds: null, collisionsEnabled: false});
    this.body = this.world.add(new Body({m: 1, radius: 0.01}));
    this.stopping = this.world.addForce(new StoppingForce(1));
    this.scatter = this.world.addForce(new ScatteringForce(rand, sigma));
    this.isotope = null;
    this.setIsotope('F-18');
  }

  setIsotope(key) {
    const iso = ISOTOPES[key];
    if (!iso) throw Error(`Unknown isotope ${key}`);
    this.isotope = key;
    this.sampleEnergy = makeBetaSampler(iso.emax);
    this.vStop = this.stopFraction;   // v scaled so that v = 1 at Emax
    this.lengthScale = 1;
    // Calibrate once so the simulated mean range matches the published value for water.
    let total = 0; const n = 1500;
    for (let i = 0; i < n; i++) total += Math.hypot(...this.run(false).displacement);
    this.lengthScale = iso.meanRange / (total / n);
    // Lookup table of displacements used for fast bulk acquisition.
    this.table = new Float64Array(2 * 4000);
    for (let i = 0; i < 4000; i++) {
      const [dx, dy] = this.run(false).displacement;
      this.table[2 * i] = dx; this.table[2 * i + 1] = dy;
    }
  }

  // Integrate one positron track. Returns displacement (mm) and optionally the path.
  run(record = true) {
    const iso = ISOTOPES[this.isotope], b = this.body, w = this.world;
    const T = this.sampleEnergy(this.rand);
    const v0 = Math.sqrt(T / iso.emax);       // non-relativistic speed scaling
    const angle = 2 * Math.PI * this.rand();
    b.pos.set(0, 0); b.vel.set(v0 * Math.cos(angle), v0 * Math.sin(angle)); w.time = 0;
    const path = record ? [[0, 0]] : null;
    let steps = 0;
    while (b.vel.length() > this.vStop && steps < 2000) {
      const v = b.vel.length();
      const dt = this.eta * v * v * v / this.stopping.b;  // keeps Δv/v ≈ eta each step
      this.scatter.dt = dt;
      w.step(dt);
      steps++;
      if (record) path.push([b.pos.x * this.lengthScale, b.pos.y * this.lengthScale]);
    }
    return {
      energy: T, steps,
      displacement: [b.pos.x * this.lengthScale, b.pos.y * this.lengthScale],
      path
    };
  }

  // Fast sample from the precomputed table, randomly rotated. Returns mm.
  sample() {
    const i = Math.floor(this.rand() * 4000), a = 2 * Math.PI * this.rand();
    const x = this.table[2 * i], y = this.table[2 * i + 1], c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }
}
