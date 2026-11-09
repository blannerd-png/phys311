// Slow-motion replay of one real decay from the acquisition: positron track (zoomed inset),
// annihilation, and the two photons travelling to the ring. Display speeds are slowed down
// enormously: a real photon crosses the scanner in ~1 ns, a positron stops in ~picoseconds.
const PHOTON_SPEED = 55;        // displayed cm per second of real time
const POSITRON_TIME = 0.8, HOLD_TIME = 1.0;

export class EventAnimator {
  constructor() {this.event = null; this.t = 0;}
  get ready() {return !this.event || this.t > this.duration;}

  start(ev) {
    this.event = ev; this.t = 0;
    this.lengths = ev.photons.map(p => polylineLength(p.path));
    this.duration = POSITRON_TIME + Math.max(...this.lengths) / PHOTON_SPEED + HOLD_TIME;
  }
  update(dt) {if (this.event) this.t += dt;}

  // Plain-language summary of what happened to this decay (shown under the canvas).
  caption() {
    const ev = this.event; if (!ev) return 'Waiting for the first decay…';
    const dev = ev.ann.deviationDeg, [x, y] = ev.annihilation;
    const rangeMm = Math.hypot(x - ev.emission[0], y - ev.emission[1]) * 10;
    const describe = (p, name) => {
      if (p.absorbed) return `${name} was absorbed in the body`;
      const sc = p.scatters ? `Compton-scattered ${p.scatters}× (now ${p.E.toFixed(0)} keV)` : `unscattered (${p.E.toFixed(1)} keV)`;
      if (!p.detected) return `${name} ${sc}, reached the ring but was not detected`;
      if (!p.inWindow) return `${name} ${sc}, measured ${p.measuredE.toFixed(0)} keV: rejected by the energy window`;
      return `${name} ${sc}, accepted by crystal ${p.crystal}`;
    };
    const both = ev.photons.every(p => p.inWindow);
    return `Positron travelled ${rangeMm.toFixed(2)} mm, then annihilated into two photons ${(180 - dev).toFixed(2)}° apart ` +
      `(E₁+E₂ = ${(ev.ann.photons[0].E + ev.ann.photons[1].E).toFixed(3)} keV). ` +
      `${describe(ev.photons[0], 'Photon A')}; ${describe(ev.photons[1], 'photon B')}. ` +
      (both ? 'Both photons accepted, so the pair can form a line of response.' : 'No line of response from this decay.');
  }

  draw(ctx, camera, dpr, showInset) {
    const ev = this.event, t = this.t;
    const ann = camera.toScreen({x: ev.annihilation[0], y: ev.annihilation[1]});
    // Marker where the decay happened.
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.arc(ann.x, ann.y, 7 * dpr, 0, 2 * Math.PI); ctx.stroke();

    const tp = t - POSITRON_TIME;
    if (tp > 0) {
      const dist = tp * PHOTON_SPEED;
      ev.photons.forEach((p, i) => {
        const pts = p.path, upto = Math.min(dist, this.lengths[i]);
        const {trail, head, segment} = walk(pts, upto);
        ctx.lineWidth = 2.2 * dpr; ctx.setLineDash([]);
        for (let k = 1; k < trail.length; k++) {
          const a = camera.project(...trail[k - 1]), b = camera.project(...trail[k]);
          ctx.strokeStyle = k === 1 ? '#ffd56b' : '#ff9248';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        for (let k = 1; k < pts.length - 1 && k <= segment; k++) {       // Compton vertices
          const v = camera.project(...pts[k]); cross(ctx, v.x, v.y, 5 * dpr, '#ff9248');
        }
        const h = camera.project(...head);
        const done = upto >= this.lengths[i];
        ctx.fillStyle = segment === 0 ? '#ffd56b' : '#ff9248';
        ctx.beginPath(); ctx.arc(h.x, h.y, 4 * dpr, 0, 2 * Math.PI); ctx.fill();
        if (done) {
          if (p.absorbed) cross(ctx, h.x, h.y, 7 * dpr, '#ff6b6b');
          else {
            ctx.strokeStyle = p.inWindow ? '#7ee4a2' : p.detected ? '#9aa7b8' : '#ff6b6b';
            ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(h.x, h.y, 9 * dpr, 0, 2 * Math.PI); ctx.stroke();
          }
        }
      });
      // Line of response once both photons are accepted.
      const finished = ev.photons.every((p, i) => dist >= this.lengths[i]);
      if (finished && ev.photons.every(p => p.inWindow)) {
        const a = camera.project(...ev.photons[0].path.at(-1)), b = camera.project(...ev.photons[1].path.at(-1));
        ctx.strokeStyle = ev.photons.some(p => p.scatters) ? '#ffb057' : '#7ee4a2';
        ctx.setLineDash(ev.photons.some(p => p.scatters) ? [7 * dpr, 5 * dpr] : []);
        ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (showInset && ev.track) this.drawInset(ctx, dpr, Math.min(1, t / POSITRON_TIME));
  }

  // Zoomed positron track, in millimetres.
  drawInset(ctx, dpr, progress) {
    const ev = this.event, size = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.3, x0 = 12 * dpr, y0 = ctx.canvas.height - size - 12 * dpr;
    ctx.fillStyle = '#0b1424ee'; ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = '#3d5878'; ctx.lineWidth = 1 * dpr; ctx.strokeRect(x0, y0, size, size);
    const track = ev.track;
    let ext = 0.5; for (const [x, y] of track) ext = Math.max(ext, Math.abs(x), Math.abs(y));
    const scale = (size * 0.38) / ext, cx = x0 + size / 2, cy = y0 + size / 2 + 6 * dpr;
    const n = Math.max(2, Math.ceil(progress * track.length));
    ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1.6 * dpr; ctx.beginPath();
    for (let i = 0; i < n; i++) {const [x, y] = track[i]; const X = cx + x * scale, Y = cy - y * scale; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);}
    ctx.stroke();
    ctx.fillStyle = '#ff8c3c'; ctx.beginPath(); ctx.arc(cx, cy, 3.5 * dpr, 0, 2 * Math.PI); ctx.fill();   // nucleus
    if (progress >= 1) {
      const [ex, ey] = track.at(-1), X = cx + ex * scale, Y = cy - ey * scale;
      star(ctx, X, Y, 6 * dpr, '#ffe08a');
      // Photon directions, with the non-collinearity exaggerated 20× so it is visible.
      const d = ev.ann.photons.map(p => p.dir), base = Math.atan2(d[0][1], d[0][0]);
      let off = Math.atan2(d[1][1], d[1][0]) - base - Math.PI;          // signed offset from 180°
      off = Math.atan2(Math.sin(off), Math.cos(off));
      for (const ang of [base, base + Math.PI + 20 * off]) arrow(ctx, X, Y, Math.cos(ang) * size * 0.2, -Math.sin(ang) * size * 0.2, '#ffd56b', dpr);
    }
    // Scale bar.
    const bar = niceLength(ext / 2), barPx = bar * scale;
    ctx.strokeStyle = '#dcecff'; ctx.lineWidth = 2 * dpr; ctx.beginPath();
    ctx.moveTo(x0 + 10 * dpr, y0 + size - 12 * dpr); ctx.lineTo(x0 + 10 * dpr + barPx, y0 + size - 12 * dpr); ctx.stroke();
    ctx.fillStyle = '#dcecff'; ctx.font = `${10 * dpr}px system-ui`;
    ctx.fillText(`${bar} mm`, x0 + 14 * dpr + barPx, y0 + size - 8 * dpr);
    ctx.fillText('Positron track (zoomed)', x0 + 8 * dpr, y0 + 14 * dpr);
    ctx.fillStyle = '#93a9c3';
    ctx.fillText('photon angle offset ×20', x0 + 8 * dpr, y0 + 27 * dpr);
  }
}

function polylineLength(p) {let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L;}
function walk(p, dist) {
  const trail = [p[0]]; let left = dist;
  for (let i = 1; i < p.length; i++) {
    const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (left <= L) {
      const f = L > 0 ? left / L : 1, h = [p[i - 1][0] + f * (p[i][0] - p[i - 1][0]), p[i - 1][1] + f * (p[i][1] - p[i - 1][1])];
      trail.push(h); return {trail, head: h, segment: i - 1};
    }
    left -= L; trail.push(p[i]);
  }
  return {trail, head: p.at(-1), segment: p.length - 2};
}
function cross(ctx, x, y, r, color) {ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();}
function star(ctx, x, y, r, color) {ctx.fillStyle = color; ctx.beginPath(); for (let i = 0; i < 10; i++) {const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));} ctx.closePath(); ctx.fill();}
function arrow(ctx, x, y, dx, dy, color, dpr) {
  const tx = x + dx, ty = y + dy, a = Math.atan2(dy, dx);
  ctx.strokeStyle = color; ctx.lineWidth = 1.6 * dpr; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty);
  ctx.lineTo(tx - 6 * dpr * Math.cos(a - 0.5), ty - 6 * dpr * Math.sin(a - 0.5)); ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 6 * dpr * Math.cos(a + 0.5), ty - 6 * dpr * Math.sin(a + 0.5)); ctx.stroke();
}
function niceLength(x) {const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return +((m >= 5 ? 5 : m >= 2 ? 2 : 1) * p).toPrecision(2);}
