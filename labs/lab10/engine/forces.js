export class Gravity {
  constructor(g=9.81){this.g=g;}
  apply(world){for(const b of world.bodies)if(!b.isStatic)b.force.y-=b.m*this.g;}
  potentialEnergy(world){return world.bodies.reduce((u,b)=>u+(b.isStatic?0:b.m*this.g*b.pos.y),0);}
}
export class Drag {
  constructor(c=.1){this.c=c;}
  apply(world){for(const b of world.bodies){if(b.isStatic)continue;const s=b.vel.length();b.force.addScaled(b.vel,-this.c*s);}}
}
export class Spring {
  constructor(a,b,k=5,restLength=2){this.a=a;this.b=b;this.k=k;this.restLength=restLength;}
  apply(){const d=this.b.pos.sub(this.a.pos);const r=d.length();if(r<1e-12)return;
    const scale=this.k*(r-this.restLength)/r;
    if(!this.a.isStatic)this.a.force.addScaled(d,scale);
    if(!this.b.isStatic)this.b.force.addScaled(d,-scale);
  }
  potentialEnergy(){const x=this.b.pos.sub(this.a.pos).length()-this.restLength;return .5*this.k*x*x;}
}
export class NewtonGravity {
  constructor(G=1,softening=.1){this.G=G;this.eps=softening;}
  apply(world){const bs=world.bodies;
    for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
      const a=bs[i],b=bs[j],d=b.pos.sub(a.pos);
      const r2=d.lengthSq()+this.eps**2;
      const coeff=this.G*a.m*b.m/(r2*Math.sqrt(r2));
      if(!a.isStatic)a.force.addScaled(d,coeff);
      if(!b.isStatic)b.force.addScaled(d,-coeff);
    }
  }
  potentialEnergy(world){let U=0;const bs=world.bodies;
    for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
      const d=bs[j].pos.sub(bs[i].pos);
      U-=this.G*bs[i].m*bs[j].m/Math.sqrt(d.lengthSq()+this.eps**2);
    }
    return U;
  }
}
