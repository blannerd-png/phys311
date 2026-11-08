import assert from 'node:assert/strict';
import {World} from './engine/world.js';
import {Body} from './engine/body.js';
import {EulerCromer,VelocityVerlet,Euler} from './engine/integrators.js';
import {createScene} from './scenes.js';
import {MouseSpring,predictPath,bodyAt} from './input.js';
import {Vec2} from './engine/vec2.js';
const DT=1/120;
function approximate(a,b,tol=1e-8){assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);}
const scene=createScene('billiards',20,1);
assert.equal(scene.world.bodies.length,20);
const p0=scene.world.bodies[0].pos.clone();
const again=createScene('billiards',20,1);
approximate(p0.x,again.world.bodies[0].pos.x);
for(const Integrator of [Euler,EulerCromer,VelocityVerlet]){
  const w=new World({integrator:new Integrator(),bounds:null});w.add(new Body({x:0,y:0,vx:2,vy:0}));
  w.step(DT);approximate(w.time,DT);approximate(w.bodies[0].pos.x,2*DT);
}
const ms=new MouseSpring(),testWorld=new World();
const ball=testWorld.add(new Body({x:0,y:0}));ms.body=ball;ms.target=new Vec2(1,0);
testWorld.addForce(ms);testWorld.step(DT);assert.ok(ball.vel.x>0);
assert.equal(bodyAt(testWorld,ball.pos),ball);
const path=predictPath(new Vec2(0,0),new Vec2(2,2),9.81,new World(),10);
assert.equal(path.length,10);
function conservation(e){
  const w=new World({integrator:new VelocityVerlet(),bounds:null,restitution:e});
  for(let i=0;i<20;i++){
    const j=i%5,k=Math.floor(i/5);
    w.add(new Body({x:-4+2*j,y:-3+2*k,vx:0.1*(j-2)+(i%2?1:-1),vy:0.1*(k-1.5)+(i%3?-0.5:0.5),radius:.35}));
  }
  const E0=w.totalEnergy(),p0=w.totalMomentum();let maxStepIncrease=0,last=E0;
  for(let i=0;i<7200;i++){w.step(DT);const en=w.totalEnergy();maxStepIncrease=Math.max(maxStepIncrease,en-last);last=en;}
  const E1=w.totalEnergy(),p1=w.totalMomentum(),dp=p1.sub(p0).length(),drift=100*(E1-E0)/E0;
  assert.ok(dp<1e-8);assert.ok(e===1?Math.abs(E1-E0)<1e-8:E1<=E0);assert.ok(maxStepIncrease<1e-9);
  return {e,E0,E1,drift,dp,maxStepIncrease};
}
const results=[conservation(1),conservation(.8)];
console.log('PASS: imports, scene reset determinism, integrators, step time, MouseSpring, selection, trajectory');
console.table(results);
