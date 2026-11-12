// Scanner drawings: a transverse view (looking along the patient, x–y plane at height z) and a
// side view (z–y plane) showing the ring stack, the patient on the gurney and the bed positions.
import {hotCss} from './panels.js';

const TYPE_STYLE = {true: ['#7ee4a2', []], scatter: ['#ffb057', [6, 4]], random: ['#c4a1ff', [2, 4]]};

export class PetRenderer {
  constructor(canvas, camera) {this.canvas = canvas; this.camera = camera; this.ctx = canvas.getContext('2d');}

  draw(scanner, flags, animator, cursor, viewZ = 0) {
    const ctx = this.ctx, cam = this.camera, cfg = scanner.config, W = this.canvas.width, H = this.canvas.height;
    const S = (x, y) => cam.toScreen(x, y), k = cam.scale;
    ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H);
    const [cx, cy] = S(0, 0);

    // Detector ring: crystal colour = recent hit rate (summed over all rings).
    const n = cfg.crystals, R = cfg.ringRadius;
    let max = 1; for (let i = 0; i < n; i++) max = Math.max(max, scanner.crystalHits[i]);
    ctx.lineWidth = Math.max(4, 2.2 * k);
    for (let i = 0; i < n; i++) {
      const a0 = i * 2 * Math.PI / n, a1 = (i + 0.85) * 2 * Math.PI / n, v = scanner.crystalHits[i] / max;
      ctx.strokeStyle = v > 0.02 ? hotCss(0.25 + 0.75 * v) : '#24364f';
      ctx.beginPath(); ctx.arc(cx, cy, (R + 1.1) * k, -a1, -a0); ctx.stroke();
    }
    // Field of view.
    ctx.strokeStyle = '#2f4766'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, cfg.fovRadius * k, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);

    // Phantom cross-section at z = viewZ.
    const ph = scanner.phantom;
    for (const c of ph.crossSection(viewZ)) {
      const [x, y] = S(c.x, c.y);
      ctx.fillStyle = c.conc > 0 ? hotCss(0.15 + 0.7 * c.conc / ph.maxConc) : '#101a2b';
      ctx.globalAlpha = c.region.material === 'air' ? 0.25 : 0.85;
      ctx.beginPath(); ctx.arc(x, y, c.r * k, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.region.target ? '#7ee4a2' : c.region.material === 'bone' ? '#e9e2d0' : c.region.material === 'lung' ? '#6f8fb3' : '#40597a';
      ctx.lineWidth = c.region.target ? 2 : 1;
      ctx.stroke();
    }

    // Recent coincidences (LORs projected onto the transverse plane).
    if (flags.lors) {
      const ev = scanner.recent;
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i], [col, dash] = TYPE_STYLE[e.type];
        ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.lineWidth = 1;
        ctx.globalAlpha = 0.08 + 0.5 * (i + 1) / ev.length;
        const [x1, y1] = S(e.x1, e.y1), [x2, y2] = S(e.x2, e.y2);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    }

    if (flags.animate) animator.draw(ctx, p => S(p[0], p[1]), {inset: flags.inset, insetBox: {x: 10, y: H - 10 - Math.min(170, W * 0.3), w: Math.min(170, W * 0.3)}});

    if (cursor) {
      const [x, y] = S(cursor.x, cursor.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
    }
    ctx.fillStyle = '#9aadc9'; ctx.font = `${Math.max(11, W / 70)}px system-ui`;
    ctx.fillText(`Transverse view · slice z = ${viewZ.toFixed(1)} cm · ${cfg.crystals} crystals × ${cfg.rings} rings, R = ${R} cm`, 10, 18);
  }
}

// Side view: z horizontal (scanner frame, scanner centre at 0), y vertical.
export class SideRenderer {
  constructor(canvas, camera) {this.canvas = canvas; this.camera = camera; this.ctx = canvas.getContext('2d');}

  draw(scanner, flags, animator, viewZ = 0) {
    const ctx = this.ctx, cam = this.camera, cfg = scanner.config, W = this.canvas.width, H = this.canvas.height, k = cam.scale;
    const S = (z, y) => cam.toScreen(z, y);
    ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H);
    const bed = scanner.bed, half = scanner.axialLength / 2, R = cfg.ringRadius, ph = scanner.phantom;

    // Other bed positions (patient outline, faint).
    for (const b of scanner.bedOffsets) {
      if (b === bed) continue;
      const [x0, y0] = S(ph.zMin - b, ph.body.y + ph.body.r), [x1, y1] = S(ph.zMax - b, ph.body.y - ph.body.r);
      ctx.strokeStyle = 'rgba(133,214,255,0.25)'; ctx.setLineDash([4, 4]); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
    }
    // Gurney.
    let [gx0, gy] = S(ph.zMin - bed - 6, ph.body.y - ph.body.r - 1.2), [gx1] = S(ph.zMax - bed + 30, 0);
    ctx.fillStyle = '#2a3c56'; ctx.fillRect(gx0, gy, gx1 - gx0, 0.8 * k);
    // Patient (body) and regions crossing the plane x = 0 … drawn as their y–z silhouettes.
    for (const r of ph.regions) {
      const zc = r.z - bed;
      ctx.fillStyle = r.conc > 0 ? hotCss(0.15 + 0.7 * r.conc / ph.maxConc) : '#101a2b';
      ctx.globalAlpha = r === ph.body ? 0.6 : 0.85;
      ctx.strokeStyle = r.target ? '#7ee4a2' : '#40597a'; ctx.lineWidth = r.target ? 2 : 1;
      if (r.shape === 'sphere') {const [x, y] = S(zc, r.y); ctx.beginPath(); ctx.arc(x, y, r.r * k, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();}
      else {const [x0, y0] = S(r.z0 - bed, r.y + r.r), [x1, y1] = S(r.z1 - bed, r.y - r.r); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);}
    }
    ctx.globalAlpha = 1;

    // Detector rings (top and bottom of the cylinder), coloured by ring hit rate.
    let max = 1; for (let i = 0; i < cfg.rings; i++) max = Math.max(max, scanner.ringHits[i]);
    for (let i = 0; i < cfg.rings; i++) {
      const z0 = -half + i * cfg.ringPitch, v = scanner.ringHits[i] / max;
      ctx.fillStyle = v > 0.02 ? hotCss(0.25 + 0.75 * v) : '#24364f';
      for (const s of [1, -1]) {const [x0, y0] = S(z0, s > 0 ? R + 2.2 : -R), [x1, y1] = S(z0 + cfg.ringPitch * 0.85, s > 0 ? R : -R - 2.2); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);}
    }
    // Axial field of view.
    ctx.strokeStyle = '#2f4766'; ctx.setLineDash([5, 5]);
    for (const z of [-half, half]) {const [x, y0] = S(z, R), [, y1] = S(z, -R); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();}
    // Current transverse slice.
    ctx.strokeStyle = '#ffbd66'; {const [x, y0] = S(viewZ - bed, R), [, y1] = S(viewZ - bed, -R); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();}
    ctx.setLineDash([]);

    // Recent LORs projected onto the z–y plane.
    if (flags.lors) {
      const ev = scanner.recent;
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i]; if ((e.bed ?? 0) !== bed) continue;
        const [col, dash] = TYPE_STYLE[e.type];
        ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.globalAlpha = 0.08 + 0.45 * (i + 1) / ev.length;
        const [x1, y1] = S(e.z1, e.y1), [x2, y2] = S(e.z2, e.y2);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    if (flags.animate && animator.event && (animator.event.bed ?? 0) === bed) animator.draw(ctx, p => S(p[2] - bed, p[1]), {inset: false});

    ctx.fillStyle = '#9aadc9'; ctx.font = `${Math.max(11, W / 75)}px system-ui`;
    ctx.fillText(`Side view (z–y) · axial FOV ${scanner.axialLength.toFixed(0)} cm · bed ${scanner.bedIndex % scanner.bedOffsets.length + 1}/${scanner.bedOffsets.length} at ${bed >= 0 ? '+' : ''}${bed.toFixed(0)} cm`, 10, 18);
  }
}
