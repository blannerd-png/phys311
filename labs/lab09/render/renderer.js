export class Renderer {
  constructor(canvas,camera){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera=camera;}
  draw(world,showTrails=false){const ctx=this.ctx,c=this.canvas;ctx.clearRect(0,0,c.width,c.height);
    const grad=ctx.createLinearGradient(0,0,0,c.height);grad.addColorStop(0,'#111d35');grad.addColorStop(1,'#08101e');
    ctx.fillStyle=grad;ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle='#22354e';ctx.lineWidth=1;
    for(let x=0;x<c.width;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}
    for(let y=0;y<c.height;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke();}
    if(world.bounds){const a=this.camera.project(world.bounds.xMin,world.bounds.yMax),b=this.camera.project(world.bounds.xMax,world.bounds.yMin);
      ctx.strokeStyle='#64748b';ctx.lineWidth=2;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
    if(showTrails)for(const b of world.bodies){if(b.trail.length<2)continue;
      ctx.beginPath();ctx.strokeStyle=b.color+'66';ctx.lineWidth=1.3;
      b.trail.forEach((p,i)=>{const q=this.camera.project(p.x,p.y);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});ctx.stroke();}
    for(const b of world.bodies){const p=this.camera.project(b.pos.x,b.pos.y),r=this.camera.radius(b.radius);
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(r,2),0,Math.PI*2);ctx.fillStyle=b.color;ctx.fill();
      ctx.strokeStyle=b.isStatic?'#fff':'#ffffff55';ctx.lineWidth=b.isStatic?2:1;ctx.stroke();
    }
  }
}
