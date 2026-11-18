// World (cm) ↔ canvas pixels. The world y axis points up, the canvas y axis down.
import {Vec2} from '../engine/vec2.js';

export class Camera {
  constructor(canvas, view) {this.canvas = canvas; this.setView(view);}
  // Fit the view rectangle into the canvas, keeping 1:1 aspect, centred.
  setView(view) {
    this.view = {...view};
    const w = this.canvas.width, h = this.canvas.height;
    const vw = view.xMax - view.xMin, vh = view.yMax - view.yMin;
    this.scale = Math.min(w / vw, h / vh);
    this.cx = (view.xMin + view.xMax) / 2; this.cy = (view.yMin + view.yMax) / 2;
  }
  toScreen(x, y) {return [this.canvas.width / 2 + (x - this.cx) * this.scale, this.canvas.height / 2 - (y - this.cy) * this.scale];}
  toWorld(px, py) {return new Vec2(this.cx + (px - this.canvas.width / 2) / this.scale, this.cy - (py - this.canvas.height / 2) / this.scale);}
}
