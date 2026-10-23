// main.js
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");   // your drawing handle

ctx.fillStyle = "#ff8200";
ctx.beginPath();
ctx.arc(400, 300, 20, 0, 2 * Math.PI);  // x, y, r, start, end
ctx.fill();

class Camera {
  constructor(canvas, scale = 50, originX = 0, originY = 0) {
    this.canvas = canvas;
    this.scale = scale;        // pixels per physics unit (e.g. per meter)
    this.originX = originX;    // physics coord shown at bottom-left
    this.originY = originY;
  }
  toScreen(v) {
    return {
      x: (v.x - this.originX) * this.scale,
      y: this.canvas.height - (v.y - this.originY) * this.scale
    };
  }
  toWorld(px, py) {   // for mouse input in Week 10
    return new Vec2(
      px / this.scale + this.originX,
      (this.canvas.height - py) / this.scale + this.originY
    );
  }
}
class Camera {
  constructor(canvas, scale = 50, originX = 0, originY = 0) {
    this.canvas = canvas;
    this.scale = scale;        // pixels per physics unit (e.g. per meter)
    this.originX = originX;    // physics coord shown at bottom-left
    this.originY = originY;
  }
  toScreen(v) {
    return {
      x: (v.x - this.originX) * this.scale,
      y: this.canvas.height - (v.y - this.originY) * this.scale
    };
  }
  toWorld(px, py) {   // for mouse input in Week 10
    return new Vec2(
      px / this.scale + this.originX,
      (this.canvas.height - py) / this.scale + this.originY
    );
  }
}
function loop(timestamp) {
  update();                     // advance the physics
  render();                     // draw the current state
  requestAnimationFrame(loop);  // schedule the next frame
}
requestAnimationFrame(loop);    // kick it off

// Self test for vec 2
checkVec2();
let world, trail, accumulator = 0, lastFrame = null, paused = false;
const integrator = () => el("integrator").value === "cromer" ? eulerCromer : velocityVerlet;
const dt = () => Number(el("dt").value);
function reset() { world = makeProjectile(integrator()); trail = [world.bodies[0].pos.clone()]; accumulator = 0; lastFrame = null; }
reset();