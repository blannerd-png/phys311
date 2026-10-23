export class Camera {
  constructor(scale, originX, originY) {
    this.scale = scale; this.originX = originX; this.originY = originY;
  }
  toScreenX(x)   { return this.originX + x * this.scale; }
  toScreenY(y)   { return this.originY - y * this.scale; }   // MINUS = the flip
  toWorldX(px)   { return (px - this.originX) / this.scale; }
  toWorldY(py)   { return (this.originY - py) / this.scale; }
  toScreenLen(L) { return L * this.scale; }
}
