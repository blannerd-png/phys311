// Slow-motion replay of one decay: positron track → annihilation → two photons flying out to the
// detector. The engine supplies the geometry (Scanner.decay with record = true); this only animates it.
const PHASES = {positron: 0.9, flight: 1.1, hold: 0.9};
const TOTAL = PHASES.positron + PHASES.flight + PHASES.hold;

export class EventAnimator {
  constructor() {this.event = null; this.t = 0;}
  get ready() {return !this.event || this.t > TOTAL;}
  start(ev) {this.event = ev; this.t = 0;}
  update(dt) {if (this.event) this.t += dt;}

  // Fraction (0…1) of the photon flight shown so far.
  get flight() {return Math.max(0, Math.min(1, (this.t - PHASES.positron) / PHASES.flight));}

  caption() {
    const e = this.event;
    if (!e) return 'Waiting for a decay to replay…';
    const [x, y, z] = e.emission, [ax, ay, az] = e.annihilation;
    const range = Math.hypot(ax - x, ay - y, az - z) * 10;
    const fate = p => !p ? '' : p.absorbed ? 'absorbed (attenuated) in the body' : p.escaped ? 'missed the ring stack (left through an end)' :
      !p.detected ? 'reached a crystal but was not detected (efficiency)' : !p.inWindow ? `detected at ${p.measuredE.toFixed(0)} keV, outside the energy window` :
      `detected${p.scatters ? ` after ${p.scatters} Compton scatter${p.scatters > 1 ? 's' : ''}` : ''} at ${p.measuredE.toFixed(0)} keV`;
    const dev = e.ann ? `${e.ann.deviationDeg.toFixed(2)}° from back-to-back` : '';
    if (this.t < PHASES.positron) return `Decay at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) cm. The positron slows down and scatters in tissue (Lab 9 engine)…`;
    if (!e.photons.length) return `Positron travelled ${range.toFixed(2)} mm. Both photon lines miss the detector rings.`;
    return `Positron travelled ${range.toFixed(2)} mm, then annihilated: two 511 keV photons ${dev}. ` +
      `Photon 1 ${fate(e.photons[0])}; photon 2 ${fate(e.photons[1])}.` + (e.singles.length === 2 ? ' → a coincidence candidate.' : '');
  }

  // Point a fraction f along a polyline of [x, y, z] points.
  static along(path, f) {
    if (!path || path.length < 2) return path?.[0] ?? null;
    const seg = []; let L = 0;
    for (let i = 1; i < path.length; i++) {const d = Math.hypot(...[0, 1, 2].map(k => path[i][k] - path[i - 1][k])); seg.push(d); L += d;}
    let target = f * L;
    for (let i = 0; i < seg.length; i++) {
      if (target <= seg[i] || i === seg.length - 1) {
        const g = seg[i] > 0 ? Math.min(1, target / seg[i]) : 1;
        return [0, 1, 2].map(k => path[i][k] + (path[i + 1][k] - path[i][k]) * g);
      }
      target -= seg[i];
    }
    return path[path.length - 1];
  }

  // Draw in a projection: proj([x, y, z]) → [px, py] canvas pixels.
  draw(ctx, proj, {inset = true, insetBox = null} = {}) {
    const e = this.event; if (!e || this.t > TOTAL) return;
    const fade = this.t > PHASES.positron + PHASES.flight ? 1 - (this.t - PHASES.positron - PHASES.flight) / PHASES.hold : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, fade);
    const [ex, ey] = proj(e.emission), [ax, ay] = proj(e.annihilation);
    ctx.fillStyle = '#ffd56b'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 2 * Math.PI); ctx.fill();
    if (this.t >= PHASES.positron) {
      ctx.fillStyle = '#ff9248'; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, 2 * Math.PI); ctx.fill();
      const f = this.flight;
      for (const p of e.photons) {
        if (!p.path) continue;
        const pts = [];
        for (let k = 0; k <= 40; k++) {const q = EventAnimator.along(p.path, f * k / 40); if (q) pts.push(proj(q));}
        ctx.strokeStyle = p.inWindow ? '#7ee4a2' : p.absorbed ? '#fb828a' : '#9db4cf';
        ctx.lineWidth = 2; ctx.setLineDash(p.scatters ? [6, 4] : []);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        const head = pts[pts.length - 1];
        if (head) {ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head[0], head[1], 3, 0, 2 * Math.PI); ctx.fill();}
        if (f >= 1 && p.path.length) {
          const [hx, hy] = proj(p.path[p.path.length - 1]);
          ctx.strokeStyle = p.inWindow ? '#7ee4a2' : p.absorbed ? '#fb828a' : '#ffb057';
          ctx.setLineDash([]); ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 2 * Math.PI); ctx.stroke();
          if (p.absorbed) {ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx + 6, hy + 6); ctx.moveTo(hx + 6, hy - 6); ctx.lineTo(hx - 6, hy + 6); ctx.stroke();}
        }
      }
      ctx.setLineDash([]);
    }
    // Magnified positron track inset (mm scale).
    if (inset && insetBox && e.track && e.track.length > 1) {
      const {x, y, w} = insetBox;
      ctx.globalAlpha = Math.max(0, fade) * 0.95;
      ctx.fillStyle = '#0b1424'; ctx.strokeStyle = '#2a3c56'; ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, w); ctx.strokeRect(x, y, w, w);
      let m = 0.2; for (const [px, py] of e.track) m = Math.max(m, Math.abs(px), Math.abs(py));
      const sc = (w / 2 - 12) / m, n = Math.max(2, Math.ceil(e.track.length * Math.min(1, this.t / PHASES.positron)));
      ctx.strokeStyle = '#ffd56b'; ctx.lineWidth = 1.5; ctx.beginPath();
      e.track.slice(0, n).forEach(([px, py], i) => {const X = x + w / 2 + px * sc, Y = y + w / 2 - py * sc; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);});
      ctx.stroke();
      ctx.fillStyle = '#c8d8ec'; ctx.font = '11px system-ui';
      ctx.fillText('positron track (in its plane)', x + 6, y + 14);
      const bar = Math.pow(10, Math.floor(Math.log10(m)));
      ctx.fillRect(x + 8, y + w - 10, bar * sc, 2); ctx.fillText(`${bar} mm`, x + 12 + bar * sc, y + w - 6);
    }
    ctx.restore();
  }
}
