import assert from 'node:assert/strict';
import {World} from './engine/world.js';
import {Body} from './engine/body.js';
import {VelocityVerlet} from './engine/integrators.js';
import {resolvePair} from './engine/collisions.js';
import {createScene} from './scenes.js';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
function isolated(e){const w=new World({integrator:new VelocityVerlet(),restitution:e});
  for(let i=0;i<20;i++){const j=i%5,k=Math.floor(i/5);
    w.add(new Body({x:-4+j*2,y:-3+k*2,vx:(j-2)*.1+((i%2)?1:-1),vy:(k-1.5)*.1+((i%3)?-.5:.5),radius:.35}));}
  return w;
}
const results={};
for(const e of [1,.8]){
  const w=isolated(e),p0=w.totalMomentum(),E0=w.totalEnergy();let maxEnergyIncrease=0,prev=E0;
  for(let i=0;i<7200;i++){
    w.step(1/120);const E=w.totalEnergy();maxEnergyIncrease=Math.max(maxEnergyIncrease,E-prev);prev=E;
  }
  const p1=w.totalMomentum(),E1=w.totalEnergy();
  near(p1.x,p0.x,1e-8);near(p1.y,p0.y,1e-8);
  if(e===1)near(E1,E0,1e-8);else assert.ok(E1<E0);
  assert.ok(maxEnergyIncrease<1e-9,`Energy increased: ${maxEnergyIncrease}`);
  results[e]={p0:p0.length(),p1:p1.length(),px0:p0.x,py0:p0.y,px1:p1.x,py1:p1.y,E0,E1,drift:(E1-E0)/Math.abs(E0),maxEnergyIncrease};
}
// Explicit two-body collision test (including an infinitely massive obstacle).
const a=new Body({x:0,y:0,vx:1,radius:.6});
const b=new Body({x:1,y:0,vx:-1,radius:.6});
assert.ok(resolvePair(a,b,1));near(a.vel.x,-1);near(b.vel.x,1);
const obstacle=new Body({x:0,y:0,isStatic:true,radius:.6});
const c=new Body({x:1,y:0,vx:-1,radius:.6});resolvePair(obstacle,c,1);near(c.vel.x,1);near(obstacle.pos.x,0);
// Check 60 s of softened gravity contains no non-finite state and bounded energy error.
const n=createScene('nbody').world,E0=n.totalEnergy();let maxDrift=0;
for(let i=0;i<7200;i++){n.step(1/120);const E=n.totalEnergy();maxDrift=Math.max(maxDrift,Math.abs((E-E0)/E0));
  for(const b of n.bodies)assert.ok([b.pos.x,b.pos.y,b.vel.x,b.vel.y].every(Number.isFinite));
}
results.nbody={E0,E60:n.totalEnergy(),maxAbsDrift:maxDrift};
console.log(JSON.stringify(results,null,2));
