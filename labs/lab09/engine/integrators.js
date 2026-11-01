// Adapted from my Lab 8 engine.js integrators, sharing step(world,dt).
export class EulerCromer {
  step(world,dt) {
    for(const b of world.bodies) {
      if(b.fixed)continue;
      b.acc.set(b.force.x*b.invMass,b.force.y*b.invMass);
      b.vel.addScaled(b.acc,dt); // Update velocity first
      b.pos.addScaled(b.vel,dt); // Then position
    }
  }
}
export class VelocityVerlet {
  step(world,dt) {
    // Lab 8 position + acceleration scheme; prime current acceleration from forces.
    for(const b of world.bodies) {
      if(b.fixed)continue;
      b.acc.set(b.force.x*b.invMass,b.force.y*b.invMass);
      b.pos.x+=b.vel.x*dt+0.5*b.acc.x*dt*dt;
      b.pos.y+=b.vel.y*dt+0.5*b.acc.y*dt*dt;
    }
    // Lab 8: forces are recalculated at the new positions.
    for(const b of world.bodies)b.clearForce();
    for(const f of world.forces)f.apply(world);
    for(const b of world.bodies) {
      if(b.fixed)continue;
      const axNew=b.force.x*b.invMass,ayNew=b.force.y*b.invMass;
      b.vel.x+=0.5*(b.acc.x+axNew)*dt;
      b.vel.y+=0.5*(b.acc.y+ayNew)*dt;
      b.acc.set(axNew,ayNew);
    }
  }
}
