import {predictPath} from '../input.js';
export function drawOverlays(renderer,world,flags,overlay,history,gravity) {
  const {ctx,camera,canvas}=renderer;
  const scale=camera.scale;
  if(flags.vectors||flags.forceVectors)for(const b of world.bodies){
    if(b.isStatic)continue;
    const p=camera.toScreen(b.pos);
    if(flags.vectors)arrow(ctx,p.x,p.y,b.vel.x*scale*.23,-b.vel.y*scale*.23,'#7ef0c0');
    if(flags.forceVectors)arrow(ctx,p.x,p.y,b.force.x*scale*.015,-b.force.y*scale*.015,'#f8b4fc');
  }
  if(flags.flash)for(const p of overlay.flashes){
    const q=camera.toScreen(p),alpha=Math.max(0,1-(world.time-p.t)*6);
    if(alpha<=0)continue;
    ctx.beginPath();ctx.arc(q.x,q.y,10+15*(1-alpha),0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,216,120,${alpha})`;ctx.lineWidth=2;ctx.stroke();
  }
  if(overlay.aimStart&&overlay.aimEnd){
    const a=camera.toScreen(overlay.aimStart),b=camera.toScreen(overlay.aimEnd);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#ffcb6b';ctx.lineWidth=2;ctx.stroke();
    const v=overlay.aimStart.sub(overlay.aimEnd).mul(2),speed=v.length();
    if(speed>16){v.x*=16/speed;v.y*=16/speed;}
    const path=predictPath(overlay.aimStart,v,gravity,world);
    ctx.beginPath();path.forEach((point,i)=>{const q=camera.toScreen(point);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});
    ctx.strokeStyle='#ffcb6baa';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
  }
  if(overlay.cursor){const p=camera.toScreen(overlay.cursor);ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x+8,p.y);ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x,p.y+8);ctx.strokeStyle='#ffffff99';ctx.lineWidth=1;ctx.stroke();}
  if(flags.energyChart){
    const w=Math.min(230,canvas.width*.30),h=92,x=canvas.width-w-16,y=16;
    ctx.fillStyle='#0d172de0';ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='#516780';ctx.strokeRect(x,y,w,h);
    if(history.length>1){const vals=history.map(r=>r.energy),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1e-8);
      ctx.beginPath();history.forEach((row,i)=>{const px=x+8+i/(history.length-1)*(w-16),py=y+h-18-(row.energy-min)/range*(h-35);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});ctx.strokeStyle='#83ecc2';ctx.lineWidth=2;ctx.stroke();}
    ctx.fillStyle='#dcecff';ctx.font='11px system-ui';ctx.fillText('Total energy vs time',x+9,y+14);
  }
}
function arrow(ctx,x,y,dx,dy,color){const length=Math.hypot(dx,dy);if(length<2)return;const max=80;if(length>max){dx*=max/length;dy*=max/length;}const tipX=x+dx,tipY=y+dy,angle=Math.atan2(dy,dx);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tipX,tipY);ctx.lineTo(tipX-7*Math.cos(angle-.5),tipY-7*Math.sin(angle-.5));ctx.moveTo(tipX,tipY);ctx.lineTo(tipX-7*Math.cos(angle+.5),tipY-7*Math.sin(angle+.5));ctx.stroke();}
