import {createScene} from './scenes.js';
import {EulerCromer,VelocityVerlet} from './engine/integrators.js';
import {Camera} from './render/camera.js';
import {Renderer} from './render/renderer.js';
import {updateHUD} from './render/hud.js';
const $=id=>document.getElementById(id),canvas=$('sim'),camera=new Camera(canvas),renderer=new Renderer(canvas,camera);
const DT=1/120;let active,world,E0,paused=false,accumulator=0,lastTime=0,fps=60,physicsMs=0,renderMs=0;
const names={billiards:'Billiards · Elastic / inelastic collisions',nbody:'Gravitational N-body · Orbital motion',springs:'Spring network · Oscillations'};
function start(){const scene=$('scene').value, count=Number($('count').value),e=Number($('restitution').value);
  active=createScene(scene,count,e);world=active.world;camera.setView(active.view);
  $('integrator').value=scene==='billiards'?'cromer':'verlet';world.integrator=$('integrator').value==='verlet'?new VelocityVerlet():new EulerCromer();world.demoJitterBug=$('jitter').checked;
  $('collisionControls').hidden=scene!=='billiards';$('sceneName').textContent=names[scene];
  E0=world.totalEnergy();accumulator=0;lastTime=0;physicsMs=renderMs=0;
}
$('scene').addEventListener('change',start);$('count').addEventListener('change',start);
$('restitution').addEventListener('input',()=>{$('eValue').textContent=Number($('restitution').value).toFixed(2);if(world)world.restitution=Number($('restitution').value);});
$('integrator').addEventListener('change',()=>{world.integrator=$('integrator').value==='verlet'?new VelocityVerlet():new EulerCromer();});
$('jitter').addEventListener('change',()=>world.demoJitterBug=$('jitter').checked);
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';$('status').textContent=paused?'Paused':'Running';});
$('reset').addEventListener('click',start);
function frame(ms){const now=ms/1000;const delta=lastTime?Math.min(now-lastTime,.05):DT;lastTime=now;
  fps=fps*.94+.06/(delta||DT);
  if(!paused){accumulator+=delta;const begin=performance.now();let steps=0;
    while(accumulator>=DT&&steps<8){world.step(DT);accumulator-=DT;steps++;
      if(active.trails&&steps%2===0)for(const b of world.bodies){b.trail.push(b.pos.copy());if(b.trail.length>220)b.trail.shift();}
    }
    physicsMs=performance.now()-begin;
  }
  const t=performance.now();renderer.draw(world,active.trails);renderMs=performance.now()-t;
  updateHUD($('hud'),world,{fps,physicsMs,renderMs,E0,scene:$('scene').value});
  requestAnimationFrame(frame);
}
// Benchmark on same machine/browser, including collision checks and rendering.
$('benchmark').addEventListener('click',async()=>{
  const wasPaused=paused;paused=true;$('benchmark').disabled=true;
  $('benchResults').textContent='Measuring 20, 50, 100, 200…';const rows=[];
  for(const n of [20,50,100,200]){
    const s=createScene('billiards',n,1),cam=new Camera(canvas,s.view),ren=new Renderer(canvas,cam);
    let p=0,r=0,count=0;const end=performance.now()+3000;
    while(performance.now()<end){let t=performance.now();s.world.step(DT);p+=performance.now()-t;
      t=performance.now();ren.draw(s.world);r+=performance.now()-t;count++;
      if(count%100===0)await new Promise(requestAnimationFrame);
    }
    rows.push({n,p:p/count,r:r/count,fps:1000/((p+r)/count)});
  }
  $('benchResults').innerHTML='<table><tr><th>Bodies</th><th>Physics ms</th><th>Render ms</th><th>Estimated FPS*</th></tr>'+rows.map(x=>`<tr><td>${x.n}</td><td>${x.p.toFixed(3)}</td><td>${x.r.toFixed(3)}</td><td>${Math.min(60,x.fps).toFixed(1)}</td></tr>`).join('')+'</table><p class="note">*Estimated 60 Hz cap from per-frame work time; not measured display FPS. Values depend on this device and browser.</p>';
  $('benchmark').disabled=false;paused=wasPaused;accumulator=0;lastTime=0;
});
start();requestAnimationFrame(frame);
