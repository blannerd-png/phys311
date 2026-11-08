export class EulerCromer {
  step(world, dt) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.acc.set(b.force.x / b.m, b.force.y / b.m);
      b.vel.addScaled(b.acc, dt);      // velocity first
      b.pos.addScaled(b.vel, dt);      // then position
    }
  }
}

export class VelocityVerlet {
  step(world, dt) {
    // Half-kick, drift, recompute forces, half-kick: Week 9 lesson formulation.
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.acc.set(b.force.x / b.m, b.force.y / b.m);
      b.vel.addScaled(b.acc, 0.5 * dt);
      b.pos.addScaled(b.vel, dt);
    }
    for (const b of world.bodies) b.clearForce();
    for (const f of world.forces) f.apply(world);
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.acc.set(b.force.x / b.m, b.force.y / b.m);
      b.vel.addScaled(b.acc, 0.5 * dt);
    }
  }
}

export class Euler {
  step(world, dt) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.acc.set(b.force.x / b.m, b.force.y / b.m);
      b.pos.addScaled(b.vel, dt);
      b.vel.addScaled(b.acc, dt);
    }
  }
}
