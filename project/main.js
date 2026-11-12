import {createScene} from './scenes.js';
import {EulerCromer,VelocityVerlet,Euler} from './engine/integrators.js';
import {Gravity,Drag,NewtonGravity,Spring} from './engine/forces.js';
import {Camera} from './render/camera.js';
import {Renderer} from './render/renderer.js';
import {updateHUD} from './render/hud.js';
import {drawOverlays} from './render/overlays.js';
import {MouseSpring,setupPointer} from './input.js';
import {$,wireControls} from './ui.js';

const DT=1/120,canvas=$('sim'),camera=new Camera(canvas),renderer=new Renderer(canvas,camera);
let active,world,E0,paused=false,accumulator=0,lastTime=0,fps=60,physicsMs=0,renderMs=0,speed=1;
let gravity,drag,mouseSpring=new MouseSpring(),pointer,history=[],lastHistory=-1;
/* Added for lab10 bonus*/
let exportRows=[];
let nextExportTime=0.1;
const MAX_EXPORT_ROWS=200000;
let flags={trails:true,vectors:true,forceVectors:false,flash:true,energyChart:true};
const overlay={cursor:null,aimStart:null,aimEnd:null,flashes:[]};
const names={billiards:'Billiards · Collisions and conservation',nbody:'N-body gravity · Orbital motion',springs:'Spring network · Oscillations'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const n=id=>parseFloat($(id).value);
function integrator(){return $('integrator').value==='verlet'?new VelocityVerlet():$('integrator').value==='euler'?new Euler():new EulerCromer();}
function makeScene(){
  const scene=$('scene').value;
    // Disable sliders that do not apply to the selected scene
  if(scene==='nbody'){
    $('drag').value='0';
  }

  $('drag').disabled=scene==='nbody';
  $('springK').disabled=scene!=='springs';

  // Make disabled sliders visibly greyed out
  for(const id of ['drag','springK']){
    const slider=$(id);
    slider.style.opacity=slider.disabled?'0.35':'1';
    slider.style.cursor=slider.disabled?'not-allowed':'pointer';
  }
  // Orbital scenes are modeled without drag so their trajectories remain stable.
  if(scene==='nbody')$('drag').value='0';
  $('drag').disabled=scene==='nbody';
  $('springK').disabled=scene!=='springs';
  active=createScene(scene,Number($('count').value),n('restitution'),n('gravity'));
  world=active.world;
  world.integrator=integrator();
  camera.setView(active.view);
  // New forces use the existing Lab 09 Force interface, with no DOM inside engine/.
  if(scene==='billiards'){
    gravity=world.addForce(new Gravity(n('gravity')));
    drag=world.addForce(new Drag(n('drag')));
  } else if(scene==='springs'){
    gravity=world.forces.find(f=>f instanceof Gravity);
    gravity.g=n('gravity');
    drag=world.addForce(new Drag(n('drag')));
    for(const f of world.forces)if(f instanceof Spring)f.k=n('springK');
  } else {
    gravity=null;
    drag=world.addForce(new Drag(0));
    const G=n('gravity');
    world.forces.find(f=>f instanceof NewtonGravity).G=G;
    // Match each initial orbital velocity to the selected gravity strength.
    // This also works if scenes.js still uses its original G=1 default.
    const center=world.bodies[0];
    for(const b of world.bodies.slice(1)){
      const dx=b.pos.x-center.pos.x,dy=b.pos.y-center.pos.y;
      const r=Math.hypot(dx,dy);
      if(r===0)continue;
      const direction=dx*b.vel.y-dy*b.vel.x>=0?1:-1;
      const v=Math.sqrt(G*center.m/r)*direction;
      b.vel.set(-dy/r*v,dx/r*v);
    }
  }
  mouseSpring=new MouseSpring();mouseSpring.k=n('springK');
  world.addForce(mouseSpring);
  /* edited to make compatible with lab10 bonus*/
  E0=world.totalEnergy();
  history=[];lastHistory=-1;overlay.flashes=[];
  exportRows=[];
  nextExportTime=0.1;
  recordSnapshot();
  accumulator=0;lastTime=0;
  $('collisionControls').hidden=scene!=='billiards';
  $('sceneName').textContent=names[scene];
  $('gravityLabel').textContent=scene==='nbody'?'Gravity strength G':'Downward gravity g';
  $('springLabel').textContent=scene==='springs'?'Spring stiffness k (network & grab)':'Grab-spring stiffness k';
  $('gravityHint').textContent=scene==='nbody'?'Normalized gravitational constant':'Downward acceleration (m/s²)';
  $('status').textContent=paused?'Paused':'Running';
  $('pause').textContent=paused?'Resume':'Pause';
  $('cursorReadout').textContent='Move pointer onto canvas';
  refreshReadouts();
}
function reset(){pointer?.clear();makeScene();}
function refreshReadouts(){
  for(const [id,out,places] of [['restitution','eValue',2],['gravity','gValue',2],['drag','dragValue',2],['springK','kValue',0],['speed','speedValue',2]])$(out).textContent=n(id).toFixed(places)+(id==='speed'?'×':'');
}
function change(id){
  if(id==='scene'||id==='count') {
    if(id==='scene'){
      const scene=$('scene').value;
      if(scene==='nbody'){
        $('gravity').value='1';$('drag').value='0';$('springK').value='85';
        $('integrator').value='verlet';
      } else if(scene==='springs'){
        $('gravity').value='1.2';$('springK').value='13';
        $('integrator').value='verlet';
      } else {
        $('gravity').value='0';$('springK').value='85';
        $('integrator').value='cromer';
      }
    }
    reset();return;
  }
  if(id==='integrator'){world.integrator=integrator();return;}
  if(['trails','vectors','forceVectors','flash','energyChart'].includes(id)){flags[id]=$(id).checked;return;}
  if(id==='mode') {pointer?.clear();return;}
  refreshReadouts();
  if(id==='speed'){speed=clamp(n('speed'),.25,2);return;}
  if(id==='restitution')world.restitution=clamp(n('restitution'),0,1);
  if(id==='drag'){
    if($('scene').value==='nbody'){
      $('drag').value='0';
      $('dragValue').textContent='0.00';
      if(drag)drag.c=0;
      return;
    }
    if(drag)drag.c=n('drag');
  }
  if(id==='springK'){
    if($('scene').value!=='springs')return;
    mouseSpring.k=clamp(n('springK'),10,180);
    for(const f of world.forces)if(f instanceof Spring)f.k=mouseSpring.k;
  }
  if(id==='gravity'){
    if($('scene').value==='nbody'){
      reset(); // Recreate orbits with velocities suited to the new G.
      return;
    }
    if(gravity)gravity.g=n('gravity');
  }
  // Parameter changes can add/remove energy: use a new baseline for comparison.
  if(['gravity','springK','restitution','drag'].includes(id)){E0=world.totalEnergy();history=[];lastHistory=-1;}
}
function togglePause(){paused=!paused;accumulator=0;$('pause').textContent=paused?'Resume':'Pause';$('status').textContent=paused?'Paused':'Running';}
function stepOnce(){
  if(!paused)togglePause();
  accumulator=0;stepPhysics(); // exactly one DT: not one animation frame
  renderScene();
}
function speedKey(delta){const value=clamp(speed+delta,.25,2);$('speed').value=String(value);change('speed');}
/* recording function added for bonus lab10 */
function recordSnapshot(){
  if(exportRows.length+world.bodies.length>MAX_EXPORT_ROWS)return;

  const totalEnergy=world.totalEnergy();

  for(const b of world.bodies){
    exportRows.push([
      world.time,
      b.id,
      b.pos.x,
      b.pos.y,
      b.vel.x,
      b.vel.y,
      b.kineticEnergy(),
      totalEnergy
    ]);
  }
}
function stepPhysics(){
  const before=flags.flash?world.bodies.map(b=>({x:b.pos.x,y:b.pos.y,vx:b.vel.x,vy:b.vel.y})):null;
  world.step(DT);
  /*adding data recording at every .1s for bonus lab 10*/
  if(world.time+1e-9>=nextExportTime){
  recordSnapshot();
  nextExportTime+=0.1;
}
  if(flags.flash&&world.collisionsEnabled&&world.bodies.length<110){
    for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++){
      const a=world.bodies[i],b=world.bodies[j],d=a.pos.sub(b.pos);
      if(d.lengthSq()>(a.radius+b.radius+.02)**2)continue;
      const va=before[i],vb=before[j];
      if(Math.hypot(a.vel.x-va.vx,a.vel.y-va.vy)+Math.hypot(b.vel.x-vb.vx,b.vel.y-vb.vy)>.15){
        overlay.flashes.push({x:(a.pos.x+b.pos.x)/2,y:(a.pos.y+b.pos.y)/2,t:world.time});
      }
    }
  }
  if(flags.trails){for(const b of world.bodies){if(world.time%(.05)<DT){b.trail.push(b.pos.copy());if(b.trail.length>180)b.trail.shift();}}}
  if(world.time-lastHistory>=.1){history.push({t:world.time,energy:world.totalEnergy()});if(history.length>120)history.shift();lastHistory=world.time;}
  overlay.flashes=overlay.flashes.filter(p=>world.time-p.t<.17).slice(-30);
}
function renderScene(){
  const t=performance.now();renderer.draw(world,flags.trails);drawOverlays(renderer,world,flags,overlay,history,gravity?gravity.g:0);renderMs=performance.now()-t;
  updateHUD($('hud'),world,{fps,physicsMs,renderMs,E0,scene:$('scene').value});
  $('cursorReadout').textContent=overlay.cursor?`Cursor: (${overlay.cursor.x.toFixed(2)}, ${overlay.cursor.y.toFixed(2)}) m`:'Move pointer onto canvas';
}
function frame(ms){
  const now=ms/1000,delta=lastTime?clamp(now-lastTime,0,.05):0;lastTime=now;
  if(delta>0)fps=.94*fps+.06/delta;
  if(!paused){
    accumulator+=delta*speed;
    let count=0;const start=performance.now();
    while(accumulator+1e-12>=DT&&count<16){stepPhysics();accumulator-=DT;count++;}
    physicsMs=performance.now()-start;
    // Don't retain an ever-growing backlog after a suspended browser tab.
    if(count===16)accumulator=Math.min(accumulator,DT);
  }
  renderScene();requestAnimationFrame(frame);
}
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  camera.setView(active.view);
}
async function benchmark(){
  const button=$('benchmark'),oldPaused=paused;
  if(!paused)togglePause();button.disabled=true;
  $('benchResults').textContent='Measuring…';const rows=[];
  try{
    for(const size of [20,50,100,200]){
      const scene=createScene('billiards',size,1);let physics=0,render=0;
      for(let j=0;j<120;j++){
        let t=performance.now();scene.world.step(DT);physics+=performance.now()-t;
        t=performance.now();renderer.draw(scene.world);render+=performance.now()-t;
      }
      rows.push({size,p:physics/120,r:render/120});
      await new Promise(requestAnimationFrame);
    }
    $('benchResults').innerHTML='<table><thead><tr><th>Bodies</th><th>Physics ms</th><th>Render ms</th></tr></thead><tbody>'+rows.map(v=>`<tr><td>${v.size}</td><td>${v.p.toFixed(3)}</td><td>${v.r.toFixed(3)}</td></tr>`).join('')+'</tbody></table>';
  }finally{button.disabled=false;if(!oldPaused)togglePause();accumulator=0;lastTime=0;}
}
/*added control for downloading csv lab10 bonus*/
function downloadCSV(){
  const header="time,body_id,x,y,vx,vy,kinetic_energy,total_energy";

  const rows=exportRows.map(row=>row.join(","));
  const csv=[header,...rows].join("\n");

  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);

  const link=document.createElement("a");
  link.href=url;
  link.download="lab10_simulation_data.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$("downloadCSV").addEventListener("click",downloadCSV);
wireControls({change,pause:togglePause,step:stepOnce,reset,benchmark,speed:speedKey});
for(const key of Object.keys(flags))$(key).checked=flags[key];
makeScene();
pointer=setupPointer(canvas,camera,()=>world,()=>$('mode').value,{
  get body(){return mouseSpring.body;},set body(x){mouseSpring.body=x;},
  get target(){return mouseSpring.target;},set target(x){mouseSpring.target=x;}
},overlay,()=>{});
window.addEventListener('resize',resize);
resize();requestAnimationFrame(frame);