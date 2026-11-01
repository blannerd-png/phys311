// Based on my Lab 8 camera.js: preserve coordinates and the flipped screen y-axis.
import {Vec2} from '../engine/vec2.js';
export class Camera {
  constructor(canvas, view={xMin:-10,xMax:10,yMin:-6,yMax:6}) {
    this.canvas=canvas; this.view=view;
    this.setView(view);
  }
  setView(view) {
    this.view=view;
    this.scale=Math.min(this.canvas.width/(view.xMax-view.xMin),this.canvas.height/(view.yMax-view.yMin));
    this.originX=(this.canvas.width-this.scale*(view.xMin+view.xMax))/2;
    this.originY=(this.canvas.height+this.scale*(view.yMin+view.yMax))/2;
  }
  toScreenX(x) {return this.originX+x*this.scale;}
  toScreenY(y) {return this.originY-y*this.scale;}
  toWorldX(px) {return (px-this.originX)/this.scale;}
  toWorldY(py) {return (this.originY-py)/this.scale;}
  toScreenLen(length) {return length*this.scale;}
  project(x,y) {return {x:this.toScreenX(x),y:this.toScreenY(y)};}
  radius(r) {return this.toScreenLen(r);}
  toScreen(v) {return this.project(v.x,v.y);}
  toWorld(x,y) {return new Vec2(this.toWorldX(x),this.toWorldY(y));}
}
