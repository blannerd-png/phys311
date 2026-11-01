export class Camera {
  constructor(canvas,view={xMin:-10,xMax:10,yMin:-6,yMax:6}){this.canvas=canvas;this.view=view;}
  project(x,y){const v=this.view,c=this.canvas;
    return {x:(x-v.xMin)/(v.xMax-v.xMin)*c.width,y:(v.yMax-y)/(v.yMax-v.yMin)*c.height};}
  radius(r){return r*this.canvas.width/(this.view.xMax-this.view.xMin);}
}
