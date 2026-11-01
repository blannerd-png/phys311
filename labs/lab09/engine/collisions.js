export function resolvePair(a,b,e=1,skipSeparating=false){
  const d=b.pos.sub(a.pos),rs=a.radius+b.radius,dist2=d.lengthSq();
  if(dist2>=rs*rs)return false;
  const dist=Math.sqrt(dist2),n=dist>1e-12?d.mul(1/dist):{x:1,y:0};
  const ia=a.invMass,ib=b.invMass,s=ia+ib;
  if(s===0)return false;
  const overlap=rs-dist;
  a.pos.addScaled(n,-overlap*ia/s);b.pos.addScaled(n,overlap*ib/s);
  const vn=(b.vel.x-a.vel.x)*n.x+(b.vel.y-a.vel.y)*n.y;
  //if(!skipSeparating && vn>0)return true; // IMPORTANT: prevent re-colliding separating balls
  const impulse=-(1+e)*vn/s;
  a.vel.addScaled(n,-impulse*ia);b.vel.addScaled(n,impulse*ib);
  return true;
}
export function resolveWalls(b,bounds,e){
  if(b.isStatic)return;
  const r=b.radius;
  if(b.pos.x-r<bounds.xMin){b.pos.x=bounds.xMin+r;if(b.vel.x<0)b.vel.x*=-e;}
  if(b.pos.x+r>bounds.xMax){b.pos.x=bounds.xMax-r;if(b.vel.x>0)b.vel.x*=-e;}
  if(b.pos.y-r<bounds.yMin){b.pos.y=bounds.yMin+r;if(b.vel.y<0)b.vel.y*=-e;}
  if(b.pos.y+r>bounds.yMax){b.pos.y=bounds.yMax-r;if(b.vel.y>0)b.vel.y*=-e;}
}
export function resolveCollisions(world){
  if(world.bounds)for(const b of world.bodies)resolveWalls(b,world.bounds,world.restitution);
  if(!world.collisionsEnabled)return;
  const bs=world.bodies;
  for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
    // Simple broad-phase AABB rejection before distance calculation.
    const a=bs[i],b=bs[j],r=a.radius+b.radius;
    if(Math.abs(a.pos.x-b.pos.x)>r||Math.abs(a.pos.y-b.pos.y)>r)continue;
    resolvePair(a,b,world.restitution,world.demoJitterBug);
  }
}
