// Small result panels: reconstructed image, true activity, sinogram, coronal view, energy spectrum.

// "Hot iron" colormap, t in [0, 1] → [r, g, b].
export function hot(t) {
  t = Math.max(0, Math.min(1, t));
  return [Math.min(255, 3 * 255 * t), Math.max(0, Math.min(255, 3 * 255 * t - 255)), Math.max(0, Math.min(255, 3 * 255 * t - 510))];
}
export const hotCss = t => `rgb(${hot(t).map(Math.round).join(',')})`;

function title(ctx, w, text, sub) {
  ctx.fillStyle = 'rgba(8,14,25,0.75)'; ctx.fillRect(0, 0, w, sub ? 40 : 24);
  ctx.fillStyle = '#e8eefb'; ctx.font = '600 13px system-ui'; ctx.fillText(text, 8, 16);
  if (sub) {ctx.fillStyle = '#9aadc9'; ctx.font = '11px system-ui'; ctx.fillText(sub, 8, 32);}
}

// Draw an n×n image (row 0 = top) scaled to the canvas, normalised to its 99.5th percentile.
function blit(ctx, img, nx, ny, w, h, vmax = null) {
  let max = vmax;
  if (max === null) {
    const s = Array.from(img).filter(v => v > 0).sort((a, b) => a - b);
    max = s.length ? s[Math.min(s.length - 1, Math.floor(0.995 * s.length))] : 1;
  }
  const data = new ImageData(nx, ny);
  for (let i = 0; i < nx * ny; i++) {const [r, g, b] = hot(img[i] / (max || 1)); data.data[4 * i] = r; data.data[4 * i + 1] = g; data.data[4 * i + 2] = b; data.data[4 * i + 3] = 255;}
  const off = new OffscreenCanvas(nx, ny); off.getContext('2d').putImageData(data, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, h);
}

export function drawImage(canvas, img, n, label, sub, overlay = null) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  if (img) blit(ctx, img, n, n, w, h);
  if (overlay?.cnr) {
    const {cnr, fov} = overlay, toPx = (x, y) => [(x + fov) / (2 * fov) * w, (fov - y) / (2 * fov) * h], sc = w / (2 * fov);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#7ee4a2'; let [x, y] = toPx(cnr.roi.x, cnr.roi.y);
    ctx.beginPath(); ctx.arc(x, y, cnr.roi.r * sc, 0, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(133,214,255,0.8)';
    for (const r of cnr.bgRois) {[x, y] = toPx(r.x, r.y); ctx.beginPath(); ctx.arc(x, y, r.r * sc, 0, 2 * Math.PI); ctx.stroke();}
  }
  title(ctx, w, label, sub);
}

// True activity concentration in the transverse plane at height z.
export function drawTruth(canvas, phantom, fov, z = phantom.viewZ) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, n = 120, img = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const x = -fov + (ix + 0.5) * 2 * fov / n, y = fov - (iy + 0.5) * 2 * fov / n;
    img[iy * n + ix] = phantom.concAt(x, y, z);
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  blit(ctx, img, n, n, w, h, phantom.maxConc);
  title(ctx, w, `True activity at z = ${z.toFixed(1)} cm`, phantom.target ? `tumor : background = ${phantom.target.conc} : ${phantom.body.conc}` : '');
}

export function drawSinogram(canvas, sino, nAngles, nS, label = 'Sinogram (view slice)') {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  // rows = angle, columns = s
  blit(ctx, sino, nS, nAngles, w, h);
  title(ctx, w, label, 'horizontal: s (−14…14 cm) · vertical: φ (0…180°)');
}

// Coronal slice (plane y = y0) of the reconstructed volume: z horizontal, x vertical.
export function drawCoronal(canvas, vol, recon, y0, marks = {}) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const n = recon.nPix, iy = Math.max(0, Math.min(n - 1, Math.floor((recon.fov - y0) / recon.pix)));
  const img = new Float32Array(vol.nSlices * n);
  for (let k = 0; k < vol.nSlices; k++) for (let ix = 0; ix < n; ix++)
    img[(n - 1 - ix) * vol.nSlices + k] = Math.max(0, vol.data[k * n * n + iy * n + ix]);   // row = x (top = +x)
  // Keep the true aspect ratio: z extent vs 2·fov.
  const zLen = vol.nSlices * recon.dz, aspect = zLen / (2 * recon.fov);
  let dw = w, dh = w / aspect; if (dh > h - 40) {dh = h - 40; dw = dh * aspect;}
  const ox = (w - dw) / 2, oy = 40 + (h - 40 - dh) / 2;
  ctx.save(); ctx.translate(ox, oy); blit(ctx, img, vol.nSlices, n, dw, dh); ctx.restore();
  const zx = z => ox + (z - recon.z0) / zLen * dw;
  ctx.strokeStyle = '#ffbd66'; ctx.setLineDash([4, 4]);
  if (marks.viewZ !== undefined) {ctx.beginPath(); ctx.moveTo(zx(marks.viewZ), oy); ctx.lineTo(zx(marks.viewZ), oy + dh); ctx.stroke();}
  ctx.setLineDash([]);
  ctx.fillStyle = '#9aadc9'; ctx.font = '11px system-ui';
  ctx.fillText(`z = ${recon.z0.toFixed(0)} cm`, ox + 2, oy + dh - 4);
  const zEnd = `${(recon.z0 + zLen).toFixed(0)} cm`; ctx.fillText(zEnd, ox + dw - ctx.measureText(zEnd).width - 2, oy + dh - 4);
  title(ctx, w, `Coronal view (plane y = ${y0.toFixed(1)} cm), FBP of every slice`, 'horizontal: z along the patient · dashed: transverse slice shown');
}

export function drawSpectrum(canvas, spectrum, wl, wh) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, w, h);
  const max = Math.max(1, ...spectrum), x0 = 40, y0 = h - 26, pw = w - 60, ph = h - 70;
  const X = e => x0 + e / 700 * pw;
  ctx.fillStyle = 'rgba(126,228,162,0.12)'; ctx.fillRect(X(wl), y0 - ph, X(wh) - X(wl), ph);
  ctx.fillStyle = '#85d6ff';
  for (let i = 0; i < spectrum.length; i++) {const bh = spectrum[i] / max * ph; ctx.fillRect(X(i * 5), y0 - bh, Math.max(1, X(5) - X(0) - 1), bh);}
  ctx.strokeStyle = '#33455e'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + pw, y0); ctx.stroke();
  ctx.fillStyle = '#9aadc9'; ctx.font = '11px system-ui';
  for (const e of [0, 100, 200, 300, 400, 511, 600, 700]) ctx.fillText(String(e), X(e) - 8, y0 + 14);
  ctx.fillText('keV', x0 + pw + 4, y0 + 14);
  title(ctx, w, 'Energy spectrum of detected photons', `energy window ${wl}–${wh} keV (green); without scatter every photon is at 511 keV, blurred by the energy resolution`);
}
