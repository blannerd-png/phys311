import {World} from './engine/world.js';
import {Body} from './engine/body.js';
import {EulerCromer,VelocityVerlet} from './engine/integrators.js';
import {NewtonGravity,Spring,Gravity} from './engine/forces.js';
export const BOX={xMin:-9.2,xMax:9.2,yMin:-5.3,yMax:5.3};
// Seeded PRNG ensures scene resets reconstruct exactly the same initial state.
export function rng(seed=12345){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
export function createScene(name,count=20,e=1){
  if(name==='billiards'){
    const world=new World({bounds:{...BOX},restitution:e,integrator:new EulerCromer()});
    const rand=rng(1209);const radius=count>=200?.16:count>=100?.20:.24;
    const cols=Math.ceil(Math.sqrt(count*1.7));
    for(let i=0;i<count;i++){
      const x=-7.8+(i%cols)*15.6/(cols-1||1)+(rand()-.5)*.03;
      const y=-4.5+Math.floor(i/cols)*9/(Math.ceil(count/cols)-1||1)+(rand()-.5)*.03;
      const angle=rand()*Math.PI*2,speed=1.5+rand()*2;
      world.add(new Body({x,y,vx:speed*Math.cos(angle),vy:speed*Math.sin(angle),radius,m:1,color:`hsl(${Math.floor(rand()*290+20)} 80% 68%)`}));
    }
    return {world,view:{xMin:-10,xMax:10,yMin:-6,yMax:6},trails:false};
  }
  if(name==='nbody'){
    const w=new World({integrator:new VelocityVerlet(),collisionsEnabled:false});
    // Central attraction in normalized units: stable circular reference orbits.
    const G=1,M=20;w.add(new Body({m:M,radius:.32,color:'#ffd56b'}));
    for(let i=0;i<4;i++){
      const r=2.2+i*1.45,theta=i*1.5, speed=Math.sqrt(G*M/r);
      w.add(new Body({x:r*Math.cos(theta),y:r*Math.sin(theta),vx:-speed*Math.sin(theta),vy:speed*Math.cos(theta),m:.001,radius:.12+i*.013,color:['#7dd3fc','#f9a8d4','#a7f3d0','#c4b5fd'][i]}));
    }
    w.addForce(new NewtonGravity(G,.075));
    return {world:w,view:{xMin:-10,xMax:10,yMin:-6,yMax:6},trails:true};
  }
  const w=new World({integrator:new VelocityVerlet(),collisionsEnabled:false});
  const top=w.add(new Body({x:0,y:3.6,radius:.18,isStatic:true,color:'#ffffff'}));
  const bob=w.add(new Body({x:2.4,y:1.6,m:1,radius:.26,color:'#38bdf8'}));
  const bob2=w.add(new Body({x:4.4,y:.8,m:1,radius:.26,color:'#fb923c'}));
  w.addForce(new Spring(top,bob,13,3));w.addForce(new Spring(bob,bob2,10,2.2));
  w.addForce(new Gravity(1.2));
  return {world:w,view:{xMin:-10,xMax:10,yMin:-6,yMax:6},trails:true};
}
