// Secondary canvases: true tracer map, reconstructed image, sinogram and energy spectrum.
const STOPS = [[0, [0, 0, 4]], [0.2, [40, 11, 84]], [0.4, [101, 21, 110]], [0.6, [188, 55, 84]], [0.8, [249, 142, 9]], [1, [252, 255, 164]]];
const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255; let k = 0; while (k < STOPS.length - 2 && v > STOPS[k + 1][0]) k++;
    const [a, ca] = STOPS[k], [b, cb] = STOPS[k + 1], f = (v - a) / (b - a);
    for (let c = 0; c < 3; c++) lut[3 * i + c] = ca[c] + f * (cb[c] - ca[c]);
  }
  return lut;
})();

function paint(canvas, values, w, h, max) {
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const octx = off.getContext('2d'), data = octx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(255 * values[i] / max))) * 3;
    data.data[4 * i] = LUT[v]; data.data[4 * i + 1] = LUT[v + 1]; data.data[4 * i + 2] = LUT[v + 2]; data.data[4 * i + 3] = 255;
  }
  octx.putImageData(data, 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  return ctx;
}

function label(ctx, text, sub) {
  const s = ctx.canvas.width / 260;
  ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, ctx.canvas.width, sub ? 34 * s : 20 * s);
  ctx.fillStyle = '#e8eefb'; ctx.font = `${11 * s}px system-ui`; ctx.fillText(text, 7 * s, 14 * s);
  if (sub) {ctx.fillStyle = '#a8bad1'; ctx.fillText(sub, 7 * s, 28 * s);}
}

export function drawImage(canvas, img, nPix, title, sub) {
  let max = 0; const sorted = Array.from(img).filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length) max = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.998))];
  const ctx = paint(canvas, img, nPix, nPix, max || 1);
  label(ctx, title, sub);
}

export function drawTruth(canvas, phantom, fov, n = 160) {
  const vals = new Float64Array(n * n), pix = 2 * fov / n;
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++)
    vals[iy * n + ix] = phantom.concAt(-fov + (ix + 0.5) * pix, fov - (iy + 0.5) * pix);
  const ctx = paint(canvas, vals, n, n, phantom.maxConc);
  // Regions smaller than a pixel (point sources) would vanish: mark them as dots.
  const k = canvas.width / (2 * fov);
  for (const r of phantom.regions) if (r.conc > 0 && r.r * k < 3) {
    ctx.fillStyle = '#fcffa4'; ctx.beginPath(); ctx.arc((r.x + fov) * k, (fov - r.y) * k, 5, 0, 2 * Math.PI); ctx.fill();
  }
  label(ctx, 'True tracer distribution', phantom.regions.length > 12 ? 'rods: 1.6 → 0.45 cm diameter' : '');
}

export function drawSinogram(canvas, sino, nA, nS) {
  let max = 0; for (const v of sino) max = Math.max(max, v);
  const ctx = paint(canvas, sino, nS, nA, max || 1);
  label(ctx, 'Sinogram', 'across: offset s · down: angle φ 0→180°');
}

export function drawSpectrum(canvas, spectrum, low, high) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, s = W / 520;
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H);
  const left = 40 * s, right = W - 10 * s, top = 26 * s, bottom = H - 26 * s, kMax = 700;
  const X = e => left + (e / kMax) * (right - left);
  ctx.fillStyle = '#7ee4a222'; ctx.fillRect(X(low), top, X(high) - X(low), bottom - top);
  let max = 1; for (const v of spectrum) max = Math.max(max, v);
  const bw = (right - left) / spectrum.length;
  for (let i = 0; i < spectrum.length; i++) {
    const e = i * 5 + 2.5, h = (spectrum[i] / max) * (bottom - top);
    ctx.fillStyle = e >= low && e <= high ? '#7ee4a2' : '#5c708a';
    ctx.fillRect(left + i * bw, bottom - h, Math.max(1, bw - 0.5), h);
  }
  ctx.strokeStyle = '#516780'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
  ctx.fillStyle = '#a8bad1'; ctx.font = `${10 * s}px system-ui`;
  for (const e of [0, 100, 200, 300, 400, 500, 600, 700]) ctx.fillText(String(e), X(e) - 8 * s, bottom + 13 * s);
  ctx.fillText('keV', right - 18 * s, bottom + 24 * s);
  for (const [e, text] of [[511, '511 keV photopeak'], [340.7, 'Compton edge']]) {
    ctx.strokeStyle = '#ffd56b'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(e), top); ctx.lineTo(X(e), bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd56b'; ctx.fillText(text, X(e) + 3 * s, top + (e > 400 ? 10 : 22) * s);
  }
  ctx.fillStyle = '#e8eefb'; ctx.font = `${11 * s}px system-ui`;
  ctx.fillText(`Detected photon energies · window ${low}–${high} keV (shaded)`, 8 * s, 15 * s);
}
