import {EulerCromer} from './integrators.js';
import {resolveCollisions} from './collisions.js';
import {Vec2} from './vec2.js';
export class World {
  constructor({integrator=new EulerCromer(),bounds=null,restitution=1,collisionsEnabled=true}={}){
    this.bodies=[];this.forces=[];this.integrator=integrator;this.bounds=bounds;
    this.restitution=restitution;this.collisionsEnabled=collisionsEnabled;this.demoJitterBug=false;this.time=0;
  }
  add(b){this.bodies.push(b);return b;}
  addForce(f){this.forces.push(f);return f;}
  step(dt){
    for(const b of this.bodies)b.clearForce();
    for(const f of this.forces)f.apply(this);
    this.integrator.step(this,dt);
    resolveCollisions(this);
    this.time+=dt;
  }
  totalEnergy(){let E=0;for(const b of this.bodies)E+=b.kineticEnergy();
    for(const f of this.forces)E+=f.potentialEnergy?.(this)??0;
    return E;
  }
  totalMomentum(){const p=new Vec2();for(const b of this.bodies)if(!b.isStatic)p.addScaled(b.vel,b.m);return p;}
}
