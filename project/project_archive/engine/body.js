import {Vec2} from './vec2.js';
// Adapted from my Lab 8 engine.js Body, extended with stable IDs and collision data.
let nextId=0;
export class Body {
  constructor({mass=1,m=null,pos=null,vel=null,x=0,y=0,vx=0,vy=0,radius=.25,
    color='#ff8200',fixed=false,isStatic=false}={}) {
    this.mass=m??mass;
    if (!(this.mass>0)||!(radius>0)) throw Error('Mass and radius must be positive');
    this.fixed=fixed||isStatic;
    this.invMass=this.fixed?0:1/this.mass;
    this.id=nextId++;
    this.pos=pos?pos.clone():new Vec2(x,y);
    this.vel=vel?vel.clone():new Vec2(vx,vy);
    this.acc=new Vec2();this.force=new Vec2();
    this.radius=radius;this.color=color;this.trail=[];
  }
  get m(){return this.mass;}
  get isStatic(){return this.fixed;}
  clearForce(){this.force.set(0,0);}
  kineticEnergy(){return this.fixed?0:0.5*this.mass*this.vel.lengthSq();}
}
