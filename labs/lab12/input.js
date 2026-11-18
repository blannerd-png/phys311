import {Body} from './engine/body.js';
import {Vec2} from './engine/vec2.js';

// Pointer input belongs outside engine/. The camera handles the flipped y-axis.
export function eventToWorld(event, canvas, camera) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * canvas.width / rect.width;
  const py = (event.clientY - rect.top) * canvas.height / rect.height;
  return camera.toWorld(px, py);
}

export function bodyAt(world, position) {
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.isStatic) continue;
    const r = Math.max(b.radius, 0.32);
    if (b.pos.sub(position).lengthSq() <= r * r) return b;
  }
  return null;
}

// Force applied once per fixed physics step; the object remains fully collidable.
export class MouseSpring {
  constructor() {this.body=null;this.target=null;this.k=85;this.c=15;}
  apply() {
    if (!this.body || !this.target) return;
    const d=this.target.sub(this.body.pos);
    this.body.force.addScaled(d,this.k*this.body.m);
    this.body.force.addScaled(this.body.vel,-this.c*this.body.m);
  }
}

export function predictPath(start, velocity, g, world, steps=90, dt=1/60) {
  const p=start.clone(),v=velocity.clone(),path=[];
  for(let i=0;i<steps;i++) {
    v.y-=g*dt;
    p.addScaled(v,dt);
    if(world.bounds && (p.x<world.bounds.xMin||p.x>world.bounds.xMax||p.y<world.bounds.yMin||p.y>world.bounds.yMax)) break;
    path.push(p.clone());
  }
  return path;
}

export function setupPointer(canvas,camera,getWorld,getMode,mouseSpring,overlay,onChange) {
  let aimStart=null,dragging=false,pointerId=null;
  canvas.addEventListener('pointerdown',e=>{
    if(pointerId!==null)return;
    const point=eventToWorld(e,canvas,camera);
    pointerId=e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    if(getMode()==='grab') {
      mouseSpring.body=bodyAt(getWorld(),point);
      mouseSpring.target=point;
      dragging=!!mouseSpring.body;
    } else {aimStart=point; overlay.aimStart=point;overlay.aimEnd=point;}
    overlay.cursor=point;
    onChange();
  });
  canvas.addEventListener('pointermove',e=>{
    const point=eventToWorld(e,canvas,camera);
    overlay.cursor=point;
    if(pointerId===e.pointerId){
      if(dragging)mouseSpring.target=point;
      if(aimStart)overlay.aimEnd=point;
    }
    onChange();
  });
  function release(e,launch) {
    if(pointerId!==e.pointerId)return;
    const point=eventToWorld(e,canvas,camera);
    if(launch&&aimStart){
      const world=getWorld(),velocity=aimStart.sub(point).mul(2);
      const limit=velocity.length();
      if(limit>16){velocity.x*=16/limit;velocity.y*=16/limit;}
      let p=aimStart;
      const r=0.22;
      if(world.bounds)p=new Vec2(Math.max(world.bounds.xMin+r,Math.min(world.bounds.xMax-r,p.x)),Math.max(world.bounds.yMin+r,Math.min(world.bounds.yMax-r,p.y)));
      world.add(new Body({pos:p,vel:velocity,m:1,radius:r,color:'#ffcb6b'}));
    }
    dragging=false;mouseSpring.body=null;mouseSpring.target=null;
    aimStart=null;overlay.aimStart=null;overlay.aimEnd=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    pointerId=null;onChange();
  }
  canvas.addEventListener('pointerup',e=>release(e,true));
  canvas.addEventListener('pointercancel',e=>release(e,false));
  window.addEventListener('blur',()=>{dragging=false;mouseSpring.body=null;mouseSpring.target=null;aimStart=null;overlay.aimStart=null;overlay.aimEnd=null;pointerId=null;});
  return {clear(){dragging=false;mouseSpring.body=null;mouseSpring.target=null;aimStart=null;overlay.aimStart=null;overlay.aimEnd=null;pointerId=null;}};
}
