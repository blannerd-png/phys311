// Draws the scanner: detector ring, phantom, recent lines of response and the featured event.
const MATERIAL_FILL = {water: '#1b3a5c', lung: '#0f2236', bone: '#cfc6ad', air: null};
export const LOR_STYLE = {
  true:    {color: '#7ee4a2', dash: []},
  scatter: {color: '#ffb057', dash: [7, 5]},
  random:  {color: '#c4a1ff', dash: [2, 4]}
};

export class PetRenderer {
  constructor(canvas, camera) {this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.camera = camera;}

  draw(scanner, flags, animator, cursor) {
    const {ctx, canvas, camera} = this, cfg = scanner.config;
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width || canvas.width);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 10, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
    grad.addColorStop(0, '#111d35'); grad.addColorStop(1, '#070d19');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const C = camera.toScreen({x: 0, y: 0});

    // Gantry housing and detector crystals, brightness = recent hits.
    ctx.beginPath(); ctx.arc(C.x, C.y, camera.toScreenLen(cfg.ringRadius + 4.2), 0, 2 * Math.PI);
    ctx.arc(C.x, C.y, camera.toScreenLen(cfg.ringRadius - 1.2), 0, 2 * Math.PI, true);
    ctx.fillStyle = '#16243a'; ctx.fill();
    let maxHit = 1e-9; for (const h of scanner.crystalHits) maxHit = Math.max(maxHit, h);
    ctx.lineWidth = Math.max(2, camera.toScreenLen(2 * Math.PI * cfg.ringRadius / cfg.crystals) * 0.75);
    for (let i = 0; i < cfg.crystals; i++) {
      const a = (i + 0.5) * 2 * Math.PI / cfg.crystals, h = Math.sqrt(scanner.crystalHits[i] / maxHit);
      const p = camera.project(cfg.ringRadius * Math.cos(a), cfg.ringRadius * Math.sin(a));
      const q = camera.project((cfg.ringRadius + 3) * Math.cos(a), (cfg.ringRadius + 3) * Math.sin(a));
      ctx.strokeStyle = `rgb(${40 + 200 * h | 0},${70 + 150 * h | 0},${110 + 100 * h | 0})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }

    // Field of view.
    ctx.setLineDash([4 * dpr, 6 * dpr]); ctx.strokeStyle = '#3d5878'; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.arc(C.x, C.y, camera.toScreenLen(cfg.fovRadius), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);

    // Phantom: material shading plus tracer concentration in orange.
    const ph = scanner.phantom;
    for (const r of ph.regions) {
      const p = camera.toScreen(r), rad = Math.max(camera.toScreenLen(r.r), 1.5);
      const fill = MATERIAL_FILL[r.material || 'water'];
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 2 * Math.PI);
      if (fill) {ctx.fillStyle = fill; ctx.globalAlpha = r.material === 'bone' ? 0.55 : 1; ctx.fill(); ctx.globalAlpha = 1;}
      if (r.conc > 0) {ctx.fillStyle = `rgba(255,140,60,${0.08 + 0.6 * r.conc / ph.maxConc})`; ctx.fill();}
      if (r.movable) {ctx.strokeStyle = '#ffcf8a'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.stroke(); ctx.setLineDash([]);}
    }
    ctx.beginPath(); ctx.arc(camera.toScreen(ph.body).x, camera.toScreen(ph.body).y, camera.toScreenLen(ph.body.r), 0, 2 * Math.PI);
    ctx.strokeStyle = '#5b7da3'; ctx.lineWidth = 1.2 * dpr; ctx.stroke();

    // Recent coincidences.
    if (flags.lors) {
      ctx.lineWidth = 1 * dpr; ctx.globalAlpha = 0.35;
      for (const ev of scanner.recent) {
        const st = LOR_STYLE[ev.type]; ctx.strokeStyle = st.color; ctx.setLineDash(st.dash.map(v => v * dpr));
        const a = camera.project(ev.x1, ev.y1), b = camera.project(ev.x2, ev.y2);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    if (flags.animate && animator.event) animator.draw(ctx, camera, dpr, flags.inset);

    if (cursor) {
      const p = camera.toScreen(cursor);
      ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1 * dpr; ctx.beginPath();
      ctx.moveTo(p.x - 8 * dpr, p.y); ctx.lineTo(p.x + 8 * dpr, p.y); ctx.moveTo(p.x, p.y - 8 * dpr); ctx.lineTo(p.x, p.y + 8 * dpr); ctx.stroke();
    }
    if (canvas.width / dpr < 520) return;   // too narrow for labels (phones)
    ctx.fillStyle = '#93a9c3'; ctx.font = `${11 * dpr}px system-ui`;
    ctx.fillText(`Detector ring: ${cfg.crystals} crystals, radius ${cfg.ringRadius} cm`, 12 * dpr, 18 * dpr);
    ctx.fillText(`Dashed circle: ${cfg.fovRadius} cm field of view`, 12 * dpr, 34 * dpr);
  }
}
