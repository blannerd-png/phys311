// Week 13: deterministic reduction of the actual positron engine. No rendering.
// Time, position and kinetic energy here are normalized engine units, NOT physical ns/mm/keV.
import {World} from './engine/world.js';
import {Body} from './engine/body.js';
import {Euler, EulerCromer, VelocityVerlet} from './engine/integrators.js';
import {StoppingForce, ScatteringForce} from './engine/positron.js';
import {annihilate} from './engine/annihilation.js';
import {rng} from './engine/random.js';
import {conservativeConfig} from './runtime/conservative.js';
import {Scanner} from './engine/scanner.js';
import {PHANTOMS} from './engine/phantom.js';
import {writeFileSync} from 'node:fs';
const T=0.2,b=1, exactV=Math.cbrt(1-3*b*T), exactX=(1-(1-3*b*T)**(4/3))/(4*b);
function run(Integrator, N, {duration=T, stop=true, scatter=0, seed=1}={}) {
  const dt=duration/N, w=new World({integrator:new Integrator(),bounds:null,collisionsEnabled:false});
  const p=w.add(new Body({vx:1,m:1}));
  if(stop) w.addForce(new StoppingForce(b));
  if(scatter){const f=w.addForce(new ScatteringForce(rng(seed),scatter));f.dt=dt;}
  let work=0, maxIncrease=0;
  for(let i=0;i<N;i++){
    const vx=p.vel.x,vy=p.vel.y,E0=w.totalEnergy(),v=Math.hypot(vx,vy);
    w.step(dt);
    if(stop) work += -b/v*dt; // independent left Riemann approximation to integral F·v dt
    maxIncrease=Math.max(maxIncrease,w.totalEnergy()-E0);
  }
  const E=w.totalEnergy();return {dt,steps:N,x:p.pos.x,v:p.vel.length(),E,relativeDrift:Math.abs(E-.5)/.5,momentumError:Math.hypot(p.vel.x-1,p.vel.y),work,deltaE:E-.5,ledgerResidual:Math.abs(E-.5-work),maxIncrease};
}
const ns=[12,24,48,96,192,384,768]; // 1/60 … 1/3840, common T=0.2
const runs=ns.map(n=>run(EulerCromer,n));const fine=runs.at(-1).x;
const convergence=runs.map((r,i)=>({...r,errorFinest:Math.abs(r.x-fine),errorExact:Math.abs(r.x-exactX),ratio:i&&r.x!==fine?Math.abs(runs[i-1].x-fine)/Math.abs(r.x-fine):null,orderExact:i?Math.log2(Math.abs(runs[i-1].x-exactX)/Math.abs(r.x-exactX)):null}));
const free=[EulerCromer,VelocityVerlet].map(I=>({integrator:I.name,...run(I,3600,{duration:60,stop:false})}));
const stoppingCompare=[Euler,EulerCromer,VelocityVerlet].map(I=>({integrator:I.name,...run(I,48)}));
const scatterOnly=run(EulerCromer,1000,{duration:1,stop:false,scatter:.35,seed:2026});
const stress=[];
for(const sigma of [0,.35,1,2]){let maxGain=0,maxRel=0,seedWorst=0;for(let seed=1;seed<=20;seed++){const r=run(EulerCromer,12,{scatter:sigma,seed});if(r.maxIncrease>maxGain){maxGain=r.maxIncrease;seedWorst=seed;}maxRel=Math.max(maxRel,r.relativeDrift);}stress.push({sigma,maxStepEnergyGain:maxGain,maxRelativeEnergyChange:maxRel,seedWorst});}
const pair=[];
for(const [label,opts] of [['conservative',{nonCollinearity:false}],['nominal',{nonCollinearity:true}],['extreme momentum stress',{sigmaPc:1000}]]){const rand=rng(2026);let maxRelativeEnergy=0,maxAbsoluteMomentum=0,maxRelativeMomentum=0;for(let i=0;i<100000;i++){const a=annihilate(rand,opts),p=Math.hypot(...a.residual.p);maxRelativeEnergy=Math.max(maxRelativeEnergy,Math.abs(a.energyError)/a.residual.E);maxAbsoluteMomentum=Math.max(maxAbsoluteMomentum,a.momentumError);if(p>0)maxRelativeMomentum=Math.max(maxRelativeMomentum,a.momentumError/p);}pair.push({label,events:100000,maxRelativeEnergy,maxAbsoluteMomentum,maxRelativeMomentum:opts.nonCollinearity===false?null:maxRelativeMomentum});}
const sc=new Scanner(PHANTOMS.uniform.make(),conservativeConfig({activity:1e5}),2026);for(let i=0;i<100;i++)sc.acquire(1000);sc.acquire(0,{flush:true});
const out={exactX,exactV,convergence,free,stoppingCompare,scatterOnly,stress,pair,idealAcquisition:{batches:100,decays:sc.counts.decays,seconds:sc.time*1e-9,counts:sc.counts}};
console.log('Deterministic stopping convergence at normalized T =',T,'exact x =',exactX);console.table(convergence.map(({dt,x,errorFinest,errorExact,ratio,orderExact})=>({dt,x,errorFinest,errorExact,ratio,orderExact})));console.table(free);console.table(stoppingCompare);console.table(pair);console.table(stress);console.log('Scatter-only:',scatterOnly,'Ideal acquisition:',out.idealAcquisition);
writeFileSync(new URL('./results/week13-numerical.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
