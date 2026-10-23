// Code taken from code module
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  set(x, y)      { this.x = x; this.y = y; return this; }
  clone()        { return new Vec2(this.x, this.y); }

  // In-place (fast, no garbage) — used inside the hot loop
  addTo(v)       { this.x += v.x; this.y += v.y; return this; }
  addScaled(v, s){ this.x += v.x * s; this.y += v.y * s; return this; }

  // Returning new vectors — convenient, used outside the hot loop
  add(v)  { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v)  { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s)  { return new Vec2(this.x * s, this.y * s); }
  dot(v)  { return this.x * v.x + this.y * v.y; }

  lengthSq() { return this.x ** 2 + this.y ** 2; }
  length()   { return Math.sqrt(this.lengthSq()); }
  normalized() {
    const L = this.length();
    return L === 0 ? new Vec2() : this.mul(1 / L);
  }
}
export { Vec2 };