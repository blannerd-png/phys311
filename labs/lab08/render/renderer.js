export function drawGrid(ctx, canvas, cam, spacing, label) {
  ctx.strokeStyle = "#2f2f2f"; ctx.lineWidth = 1;
  ctx.fillStyle = "#888"; ctx.font = "11px monospace";

  const x0 = Math.ceil(cam.toWorldX(0) / spacing) * spacing;
  const x1 = cam.toWorldX(canvas.width);
  for (let x = x0; x <= x1; x += spacing) {
    const px = cam.toScreenX(x);
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height); ctx.stroke();
    if (Math.abs(x) > 1e-9) ctx.fillText(x.toFixed(label), px + 3, canvas.height - 5);
  }
  const y0 = Math.ceil(cam.toWorldY(canvas.height) / spacing) * spacing;
  const y1 = cam.toWorldY(0);
  for (let y = y0; y <= y1; y += spacing) {
    const py = cam.toScreenY(y);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
    if (Math.abs(y) > 1e-9) ctx.fillText(y.toFixed(label), 4, py - 4);
  }
  // axes
  ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, cam.toScreenY(0)); ctx.lineTo(canvas.width, cam.toScreenY(0));
  ctx.moveTo(cam.toScreenX(0), 0); ctx.lineTo(cam.toScreenX(0), canvas.height);
  ctx.stroke();
}

export function drawScaleBar(ctx, canvas, cam, metres, text) {
  const px = cam.toScreenLen(metres);
  const x = canvas.width - px - 24, y = 30;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
  ctx.moveTo(x + px, y - 5); ctx.lineTo(x + px, y + 5);
  ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, x + px / 2, y - 10);
  ctx.textAlign = "left";
}

export function draw(ctx, canvas, world, hud) {
  const cam = world.meta.camera;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (world.meta.kind === "spring") {
    drawGrid(ctx, canvas, cam, 0.5, 1);
    drawScaleBar(ctx, canvas, cam, 1, "1.0 m");
    const b = world.bodies[0];
    // spring line
    ctx.strokeStyle = "#6a9955"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cam.toScreenX(0), cam.toScreenY(0));
    ctx.lineTo(cam.toScreenX(b.pos.x), cam.toScreenY(b.pos.y));
    ctx.stroke();
    // anchor
    ctx.fillStyle = "#888";
    ctx.fillRect(cam.toScreenX(0) - 5, cam.toScreenY(0) - 5, 10, 10);
  } else {
    drawGrid(ctx, canvas, cam, 5, 0);
    drawScaleBar(ctx, canvas, cam, 5, "5 m");
    // ground line
    ctx.strokeStyle = "#28a745"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, cam.toScreenY(0)); ctx.lineTo(canvas.width, cam.toScreenY(0));
    ctx.stroke();
  }

  for (const b of world.bodies) {
    // trail
    if (b.trail.length > 1) {
      ctx.strokeStyle = "rgba(255,130,0,0.45)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cam.toScreenX(b.trail[0].x), cam.toScreenY(b.trail[0].y));
      for (let i = 1; i < b.trail.length; i++)
        ctx.lineTo(cam.toScreenX(b.trail[i].x), cam.toScreenY(b.trail[i].y));
      ctx.stroke();
    }
    // body
    ctx.beginPath();
    ctx.arc(cam.toScreenX(b.pos.x), cam.toScreenY(b.pos.y),
            Math.max(4, cam.toScreenLen(b.radius)), 0, Math.PI * 2);
    ctx.fillStyle = b.color; ctx.fill();
    // velocity vector
    const vs = world.meta.kind === "spring" ? 0.6 : 0.25;
    const tipX = cam.toScreenX(b.pos.x + b.vel.x * vs);
    const tipY = cam.toScreenY(b.pos.y + b.vel.y * vs);
    ctx.strokeStyle = "#9cdcfe"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cam.toScreenX(b.pos.x), cam.toScreenY(b.pos.y));
    ctx.lineTo(tipX, tipY); ctx.stroke();
  }

  // HUD
  const drift = hud.E0 === 0 ? 0 : (world.totalEnergy() - hud.E0) / hud.E0;
  const lines = [
    "t      = " + world.time.toFixed(4) + " s",
    "steps  = " + world.steps,
    "fps    = " + hud.fps.toFixed(0) + "   (steps/frame " + hud.lastSteps + ")",
    "DT     = 1/" + hud.dtDenom + " s",
    "method = " + hud.method,
    "x      = " + world.bodies[0].pos.x.toFixed(3) + " m",
    "y      = " + world.bodies[0].pos.y.toFixed(3) + " m",
    "|v|    = " + world.bodies[0].vel.length().toFixed(3) + " m/s",
    "KE     = " + world.kineticEnergy().toFixed(3) + " J",
    "PE     = " + world.potentialEnergy().toFixed(3) + " J",
    "E      = " + world.totalEnergy().toFixed(3) + " J",
    "dE/E0  = " + (drift >= 0 ? "+" : "") + drift.toExponential(3)
  ];
  ctx.font = "13px monospace"; ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(8, 8, 290, lines.length * 18 + 14);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = (i === lines.length - 1)
      ? (Math.abs(drift) > 0.01 ? "#f48771" : "#4ec9b0") : "#d4d4d4";
    ctx.fillText(lines[i], 18, 16 + i * 18);
  }
  ctx.textBaseline = "alphabetic";
}
