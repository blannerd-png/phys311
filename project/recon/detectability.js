// Tumor detectability from a reconstructed slice, using regions of interest (ROIs).
//
//   CNR = (mean in tumor ROI − mean of background ROIs) / (standard deviation of background ROI means)
//
// The background ROIs have the same size as the tumor ROI and sit in uniform background at about the
// same distance from the body centre, so their spread measures exactly the noise that could fake a tumor
// (this works for FBP/MLEM images, whose noise is correlated between neighbouring pixels).
// Rose criterion: a feature is reliably seen when CNR ≥ 5 (A. Rose, 1948).
export const ROSE_K = 5;

// image: Float32Array(n²) with pixel (ix, iy) at x = −fov + (ix+½)·pix, y = fov − (iy+½)·pix.
// lesion: {x, y, r} = tumor cross-section in this slice. body: {x, y, r}.
// isBackground(x, y): true where the phantom has background activity (no other hot or cold region).
export function lesionCNR(image, {nPix, pix, fov}, lesion, body, isBackground = () => true) {
  const roiR = Math.max(1.5 * pix, 0.75 * lesion.r);
  const roiMean = (cx, cy) => {
    let s = 0, m = 0;
    const i0 = Math.max(0, Math.floor((cx - roiR + fov) / pix)), i1 = Math.min(nPix - 1, Math.ceil((cx + roiR + fov) / pix));
    const j0 = Math.max(0, Math.floor((fov - cy - roiR) / pix)), j1 = Math.min(nPix - 1, Math.ceil((fov - cy + roiR) / pix));
    for (let iy = j0; iy <= j1; iy++) for (let ix = i0; ix <= i1; ix++) {
      const x = -fov + (ix + 0.5) * pix, y = fov - (iy + 0.5) * pix;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= roiR * roiR) {s += image[iy * nPix + ix]; m++;}
    }
    return m ? s / m : NaN;
  };
  // Background ROIs on three circles about the body centre: through the tumor and one ROI spacing
  // inside and outside it (noise in reconstructed images depends mainly on the radius).
  const dx = lesion.x - body.x, dy = lesion.y - body.y, gap = 2 * roiR + 0.4;
  let rho = Math.hypot(dx, dy);
  const maxRho = body.r - roiR - 1.5;
  if (rho < 2.5 * lesion.r + roiR) rho = Math.min(maxRho, Math.max(3 * lesion.r + roiR, body.r / 2));
  rho = Math.min(rho, maxRho);
  const theta0 = Math.atan2(dy, dx), rois = [];
  for (const rr of [rho - gap, rho, rho + gap]) {
    if (rr < gap || rr > maxRho) continue;
    const step = gap / rr;
    for (let th = theta0 + step / 2; th < theta0 + 2 * Math.PI - step / 2; th += step) {
      const cx = body.x + rr * Math.cos(th), cy = body.y + rr * Math.sin(th);
      if (Math.hypot(cx - lesion.x, cy - lesion.y) < 2 * lesion.r + 2 * roiR) continue;
      // Whole ROI must be uniform background.
      let ok = isBackground(cx, cy);
      for (let a = 0; a < 8 && ok; a++) ok = isBackground(cx + roiR * Math.cos(a * Math.PI / 4), cy + roiR * Math.sin(a * Math.PI / 4));
      if (ok) rois.push({x: cx, y: cy, r: roiR});
    }
  }
  const T = roiMean(lesion.x, lesion.y);
  const B = rois.map(r => roiMean(r.x, r.y));
  const mean = B.reduce((a, b) => a + b, 0) / Math.max(1, B.length);
  const sd = Math.sqrt(B.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, B.length - 1));
  const cnr = B.length >= 4 && sd > 0 ? (T - mean) / sd : NaN;
  return {cnr, tumorMean: T, bgMean: mean, bgSD: sd, contrast: mean > 0 ? T / mean - 1 : NaN,
    roi: {x: lesion.x, y: lesion.y, r: roiR}, bgRois: rois, detected: cnr >= ROSE_K};
}

// Convenience: CNR of the phantom's target (tumor) in a reconstructed image of the plane z.
export function tumorCNR(image, recon, phantom, z) {
  const t = phantom.target; if (!t) return null;
  const cut = phantom.crossSection(z).find(c => c.region === t);
  if (!cut) return null;
  const bg = phantom.body.conc;
  const isBg = (x, y) => {const i = phantom.regionAt(x, y, z); return i >= 0 && phantom.regions[i].conc === bg && phantom.regions[i].mu === phantom.body.mu;};
  return lesionCNR(image, recon, {x: cut.x, y: cut.y, r: cut.r}, phantom.body, isBg);
}
