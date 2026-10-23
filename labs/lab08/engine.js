import { Vec2 } from './vec2.js';

// Physics classes adapted from my Lab 7 engine.py.

// BODY
export class Body {
  constructor({ mass = 1, pos = new Vec2(), vel = new Vec2(), radius = 0.25,
                color = "#ff8200", fixed = false } = {}) {
    this.mass = mass;
    this.invMass = fixed ? 0 : 1 / mass;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.acc = new Vec2();
    this.force = new Vec2();
    this.radius = radius;
    this.color = color;
    this.fixed = fixed;
    this.trail = [];
  }
}


// FORCES
export class Gravity {
  constructor(g = 9.81) { this.g = g; }
  apply(world) {
    for (const b of world.bodies) {
      if (b.fixed) continue;
      b.force.y -= b.mass * this.g;
    }
  }
  potentialEnergy(world) {
    let U = 0;
    for (const b of world.bodies) if (!b.fixed) U += b.mass * this.g * b.pos.y;
    return U;
  }
}

export class Spring {
  constructor(body, anchor, k, restLength = 0) {
    this.body = body; this.anchor = anchor.clone();
    this.k = k; this.restLength = restLength;
  }
  apply() {
    const d = this.body.pos.sub(this.anchor);
    const L = d.length();
    if (L === 0) return;                            // guard: avoid 0/0
    const stretch = L - this.restLength;
    this.body.force.addTo(d.mul(-this.k * stretch / L));
  }
  potentialEnergy() {
    const s = this.body.pos.sub(this.anchor).length() - this.restLength;
    return 0.5 * this.k * s * s;
  }
}


// INTEGRATORS
export class Euler {
  step(world, dt) {
    for (const b of world.bodies) {
      if (b.fixed) continue;
      b.acc.set(b.force.x * b.invMass, b.force.y * b.invMass);
      b.pos.addScaled(b.vel, dt);     // position uses the OLD velocity
      b.vel.addScaled(b.acc, dt);     // ...then velocity.
    }
  }
}

export class EulerCromer {
  step(world, dt) {
    for (const b of world.bodies) {
      if (b.fixed) continue;
      b.acc.set(b.force.x * b.invMass, b.force.y * b.invMass);
      b.vel.addScaled(b.acc, dt);     // velocity FIRST
      b.pos.addScaled(b.vel, dt);     // then position, with NEW velocity
    }
  }
}

export class VelocityVerlet {
  step(world, dt) {
    // 1. drift + half kick, using acceleration carried on body
    for (const b of world.bodies) {
      if (b.fixed) continue;
      b.pos.x += b.vel.x * dt + 0.5 * b.acc.x * dt * dt;
      b.pos.y += b.vel.y * dt + 0.5 * b.acc.y * dt * dt;
    }
    // 2. recompute forces at NEW positions
    world.clearForces();
    world.applyForces();
    // 3. finish velocity with average of old and new acceleration
    for (const b of world.bodies) {
      if (b.fixed) continue;
      const axN = b.force.x * b.invMass, ayN = b.force.y * b.invMass;
      b.vel.x += 0.5 * (b.acc.x + axN) * dt;
      b.vel.y += 0.5 * (b.acc.y + ayN) * dt;
      b.acc.set(axN, ayN);            // carry forward
    }
  }
}


// WORLD
export class World {
  constructor(integrator) {
    this.bodies = []; this.forces = [];
    this.integrator = integrator;
    this.time = 0; this.steps = 0;
  }
  add(b)      { this.bodies.push(b); return b; }
  addForce(f) { this.forces.push(f); return f; }

  clearForces() { for (const b of this.bodies) b.force.set(0, 0); }
  applyForces() { for (const f of this.forces) f.apply(this); }

  primeAccelerations() {
    this.clearForces(); this.applyForces();
    for (const b of this.bodies) {
      if (b.fixed) continue;
      b.acc.set(b.force.x * b.invMass, b.force.y * b.invMass);
    }
  }

  step(dt) {
    this.clearForces();
    this.applyForces();
    this.integrator.step(this, dt);
    this.time += dt;
    this.steps += 1;
  }

  kineticEnergy() {
    let K = 0;
    for (const b of this.bodies) if (!b.fixed) K += 0.5 * b.mass * b.vel.lengthSq();
    return K;
  }
  potentialEnergy() {
    let U = 0;
    for (const f of this.forces) if (f.potentialEnergy) U += f.potentialEnergy(this);
    return U;
  }
  totalEnergy() { return this.kineticEnergy() + this.potentialEnergy(); }
}
