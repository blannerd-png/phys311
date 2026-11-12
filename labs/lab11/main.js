import {Scanner} from './engine/scanner.js';
import {PHANTOMS} from './engine/phantom.js';
import {ISOTOPES} from './engine/positron.js';
import {Reconstructor} from './recon/reconstruction.js';
import {tumorCNR, ROSE_K} from './recon/detectability.js';
import {Camera} from './render/camera.js';
import {PetRenderer, SideRenderer} from './render/petRenderer.js';
import {EventAnimator} from './render/eventAnimation.js';
import {drawImage, drawTruth, drawSinogram, drawSpectrum, drawCoronal} from './render/panels.js';
import {updatePetHUD} from './render/petHud.js';
import {eventToWorld} from './input.js';
import {$, wireControls, SPEEDS, activityFromSlider, ctrFromSlider} from './ui.js';

const VIEW = {xMin: -46, xMax: 46, yMin: -46, yMax: 46};
const SIDE_VIEW = {xMin: -62, xMax: 62, yMin: -46, yMax: 46};
const canvas = $('sim'), camera = new Camera(canvas, VIEW), renderer = new PetRenderer(canvas, camera);
const side = $('side'), sideCamera = new Camera(side, SIDE_VIEW), sideRenderer = new SideRenderer(side, sideCamera);
const recon = new Reconstructor();
const animator = new EventAnimator();
const scanner = new Scanner(PHANTOMS.tumor.make(), {bedDwell: 40});
scanner.onCoincidence = ev => recon.add(ev);

const flags = {lors: true, animate: true, inset: true, liveCnr: true};
const RECON_NAMES = {fbp: 'Filtered backprojection', bp: 'Simple backprojection', mlem: 'MLEM', tof: 'TOF backprojection', tofmlem: 'TOF MLEM'};
let paused = false, cursor = null, lastTime = 0, fps = 60, physicsMs = 0, reconMs = 0;
let reconTimer = 0, hudTimer = 0, cnrTimer = 0, coronalTimer = 0, imageDirty = true, drag = null, viewZ = 0, lastCnr = null;

const n = id => parseFloat($(id).value);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Copy every slider/checkbox into the scanner config (values clamped to the ranges the model supports).
function readConfig() {
  const c = scanner.config;
  c.positronRange = $('positronRange').checked;
  c.nonCollinearity = $('nonCollinearity').checked;
  c.attenuation = $('attenuation').checked;
  c.scatter = $('scatter').checked;
  c.activity = activityFromSlider(clamp(n('activity'), 0, 100));
  c.efficiency = clamp(n('efficiency'), 5, 100) / 100;
  c.timingResolution = ctrFromSlider(clamp(n('ctr'), 0, 100));
  c.autoWindow = $('autoWindow').checked;
  c.coincidenceWindow = clamp(n('coincWindow'), 1, 60);
  c.windowLow = clamp(n('windowLow'), 200, 500);
  c.energyResolution = clamp(n('energyRes'), 4, 25) / 100;
  c.rings = clamp(Math.round(n('rings')), 1, 48);
  c.maxRingDiff = {'3d': c.rings - 1, septa: 3, '2d': 0}[$('ringMode').value];
  c.beds = clamp(Math.round(n('beds')), 1, 4);
  c.bedStep = clamp(n('bedStep'), 4, 12);
  $('coincWindow').disabled = c.autoWindow;
  refreshReadouts();
}

function refreshReadouts() {
  const c = scanner.config, A = c.activity, t = scanner.phantom.target;
  $('activityValue').textContent = A >= 1e6 ? `${(A / 1e6).toFixed(1)} MBq` : `${(A / 1e3).toFixed(0)} kBq`;
  $('efficiencyValue').textContent = `${(c.efficiency * 100).toFixed(0)} % (pairs ${(c.efficiency ** 2 * 100).toFixed(0)} %)`;
  const tofCm = 29.98 * c.timingResolution / 1000 / 2;
  $('ctrValue').textContent = c.timingResolution >= 1000 ? `${(c.timingResolution / 1000).toFixed(1)} ns (Δx ≈ ${tofCm.toFixed(0)} cm)` : `${c.timingResolution} ps (Δx ≈ ${tofCm.toFixed(1)} cm)`;
  $('coincWindowValue').textContent = `${scanner.window.toFixed(1)} ns`;
  $('windowLowValue').textContent = `${c.windowLow} – ${c.windowHigh} keV`;
  $('energyResValue').textContent = `${(c.energyResolution * 100).toFixed(0)} %`;
  $('ringsValue').textContent = `${c.rings} (${scanner.axialLength.toFixed(1)} cm axial)`;
  $('bedsValue').textContent = String(c.beds);
  $('bedStepValue').textContent = `${c.bedStep} cm`;
  $('tumorRatioValue').textContent = t ? `${(t.conc / scanner.phantom.body.conc).toFixed(1)} : 1` : '–';
  $('tumorRadiusValue').textContent = t ? `${t.r.toFixed(1)} cm` : '–';
  $('tumorZValue').textContent = t ? `${t.z.toFixed(1)} cm` : '–';
  $('viewZValue').textContent = `${viewZ.toFixed(1)} cm`;
  const sp = SPEEDS[clamp(Math.round(n('speed')), 0, SPEEDS.length - 1)];
  $('speedValue').textContent = `${sp.toLocaleString()} decay${sp > 1 ? 's' : ''}/frame`;
  $('bedReadout').textContent = c.beds > 1 ? `bed offsets ${scanner.bedOffsets.map(b => (b > 0 ? '+' : '') + b).join(', ')} cm` : 'one bed position';
}

// Reconstruction grid along z covers every bed position.
function updateGeometry() {
  const c = scanner.config, beds = scanner.bedOffsets, half = scanner.axialLength / 2, dz = 0.5;
  const z0 = Math.floor((Math.min(...beds) - half) / dz) * dz, z1 = Math.ceil((Math.max(...beds) + half) / dz) * dz;
  recon.setAxial({z0, dz, nSlices: Math.max(1, Math.round((z1 - z0) / dz))});
  recon.setGeometry(c, beds);
  $('viewZ').min = String(z0 + dz / 2); $('viewZ').max = String(z1 - dz / 2);
  setViewZ(clamp(viewZ, z0 + dz / 2, z1 - dz / 2));
}

function setViewZ(z) {
  viewZ = z; $('viewZ').value = String(z);
  scanner.phantom.viewZ = z; recon.setViewZ(z);
  imageDirty = true; refreshReadouts();
  drawTruth($('truth'), scanner.phantom, recon.fov, viewZ);
}

// Start a fresh acquisition (any change to the physics or scanner invalidates collected data).
function clearData() {
  scanner.reset(); animator.event = null; lastCnr = null;
  updateGeometry();
  recon.setAttenuationFromPhantom(scanner.phantom);
  imageDirty = true; cnrTimer = 0;
  $('detect').innerHTML = 'Collecting data…';
  drawTruth($('truth'), scanner.phantom, recon.fov, viewZ);
}

function syncTumorSliders() {
  const t = scanner.phantom.target, has = !!t;
  for (const id of ['tumorRatio', 'tumorRadius', 'tumorZ']) $(id).disabled = !has;
  if (has) {$('tumorRatio').value = String(t.conc / scanner.phantom.body.conc); $('tumorRadius').value = String(t.r); $('tumorZ').value = String(t.z);}
}

function setPhantom(key) {
  scanner.setPhantom(PHANTOMS[key].make());
  $('phantomName').textContent = PHANTOMS[key].label;
  const editable = ['tumor', 'torso', 'uniform'].includes(key);
  $('addLesion').disabled = !editable; $('removeLesions').disabled = !editable;
  syncTumorSliders();
  clearData();
  if (scanner.phantom.target) setViewZ(scanner.phantom.target.z);
}

function applyTumor() {
  const ph = scanner.phantom, t = ph.target; if (!t) return;
  t.conc = n('tumorRatio') * ph.body.conc; t.r = n('tumorRadius'); t.z = n('tumorZ');
  ph.prepare(); clearData(); setViewZ(t.z);
}

function change(id) {
  if (id === 'phantom') {setPhantom($('phantom').value); return;}
  if (id === 'isotope') {
    scanner.setIsotope($('isotope').value);
    $('isotopeName').textContent = `${ISOTOPES[$('isotope').value].name} · ${ISOTOPES[$('isotope').value].use} · mean positron range ${ISOTOPES[$('isotope').value].meanRange} mm`;
    clearData(); return;
  }
  if (['lors', 'animate', 'inset', 'liveCnr'].includes(id)) {flags[id] = $(id).checked; return;}
  if (id === 'recon' || id === 'attenCorr') {recon.mlemImage = null; imageDirty = true; reconTimer = 99; return;}
  if (id === 'speed') {refreshReadouts(); return;}
  if (id === 'viewZ') {setViewZ(n('viewZ')); return;}
  if (['tumorRatio', 'tumorRadius', 'tumorZ'].includes(id)) {applyTumor(); refreshReadouts(); return;}
  readConfig(); clearData();
}

function togglePause() {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('status').textContent = paused ? 'Paused' : 'Running';
}

function step() {
  if (!paused) togglePause();
  const featured = scanner.acquire(1, {recordFirst: true, flush: true});
  if (featured) animator.start(featured);
  imageDirty = true;
}

function speedKey(delta) {$('speed').value = String(clamp(n('speed') + delta, 0, SPEEDS.length - 1)); refreshReadouts();}
function sliceKey(delta) {setViewZ(clamp(viewZ + delta * recon.dz, parseFloat($('viewZ').min), parseFloat($('viewZ').max)));}

// ---- Tumor detectability --------------------------------------------------------------------
function measureCnr() {
  const ph = scanner.phantom, t = ph.target, el = $('detect');
  if (!t) {el.innerHTML = '<span class="muted">This phantom has no tumor. Choose “Water cylinder with a tumor”.</span>'; return;}
  const k0 = recon.sliceOf(t.z - 0.5), k1 = recon.sliceOf(t.z + 0.49);
  if (k1 < 0 || k0 >= recon.nSlices || recon.sliceSens[Math.max(0, Math.min(recon.nSlices - 1, Math.round((k0 + k1) / 2)))] === 0) {
    el.innerHTML = '<span class="verdict warn">Not detected</span><span class="muted">The tumor is outside the axial field of view. Add bed positions or more rings.</span>';
    lastCnr = null; return;
  }
  const events = recon.sinoSlab(Math.max(0, k0), Math.min(recon.nSlices - 1, k1)).reduce((a, b) => a + b, 0);
  if (events < 200) {el.innerHTML = `<span class="muted">Only ${events} events in the tumor slab so far…</span>`; return;}
  const t0 = performance.now();
  const img = recon.mlemSlab($('attenCorr').checked, 6, Math.max(0, k0), Math.min(recon.nSlices - 1, k1));
  const r = tumorCNR(img, recon, ph, t.z);
  lastCnr = r ? {...r, z: t.z} : null;
  if (!r || !Number.isFinite(r.cnr)) {el.innerHTML = '<span class="muted">Not enough background area to measure the noise.</span>'; return;}
  const ok = r.cnr >= ROSE_K;
  el.innerHTML = `<span class="verdict ${ok ? 'good' : 'warn'}">${ok ? 'Detected' : 'Not detected'}</span>` +
    `<div class="hudRow"><span class="hudLabel">Contrast-to-noise ratio</span><span class="hudValue ${ok ? 'good' : 'warn'}">${r.cnr.toFixed(1)} (need ≥ ${ROSE_K})</span></div>` +
    `<div class="hudRow"><span class="hudLabel">Measured contrast (true ${(t.conc / ph.body.conc - 1).toFixed(1)})</span><span class="hudValue">${r.contrast.toFixed(2)}</span></div>` +
    `<div class="hudRow"><span class="hudLabel">Events in 1 cm tumor slab</span><span class="hudValue">${events.toLocaleString()}</span></div>` +
    `<div class="hudRow"><span class="hudLabel">Background ROIs / MLEM time</span><span class="hudValue">${r.bgRois.length} / ${(performance.now() - t0).toFixed(0)} ms</span></div>`;
}

function gotoTumor() {const t = scanner.phantom.target; if (t) setViewZ(t.z);}

// ---- Lesion editing -------------------------------------------------------------------------
function addLesionAt(x, y) {
  const ph = scanner.phantom, body = ph.body;
  if (ph.regions.filter(r => r.added).length >= 8) return;
  const r = 0.8, d = Math.hypot(x - body.x, y - body.y), max = body.r - r - 0.2;
  if (d > max) {x = body.x + (x - body.x) * max / d; y = body.y + (y - body.y) * max / d;}
  ph.regions.push({name: 'Added lesion', shape: 'sphere', x, y, z: viewZ, r, material: 'water', mu: 0.096, density: 1,
    conc: n('tumorRatio') * body.conc, movable: true, added: true});
  ph.prepare(); clearData();
}
function addLesionRandom() {
  const b = scanner.phantom.body, a = Math.random() * 2 * Math.PI, r = Math.random() * (b.r - 2);
  addLesionAt(b.x + r * Math.cos(a), b.y + r * Math.sin(a));
}
function removeLesions() {
  const ph = scanner.phantom; ph.regions = ph.regions.filter(r => !r.added); ph.prepare(); clearData();
}

canvas.addEventListener('pointerdown', e => {
  const p = eventToWorld(e, canvas, camera), ph = scanner.phantom;
  const hit = ph.crossSection(viewZ).reverse().find(c => c.region.movable && Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 0.6);
  if (hit) {drag = {region: hit.region, id: e.pointerId}; canvas.setPointerCapture(e.pointerId); return;}
  const editable = ['tumor', 'torso', 'uniform'].includes(ph.name);
  if (editable && Math.hypot(p.x - ph.body.x, p.y - ph.body.y) < ph.body.r) addLesionAt(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  const p = eventToWorld(e, canvas, camera); cursor = p;
  $('cursorReadout').textContent = `Cursor: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${viewZ.toFixed(1)}) cm · r = ${Math.hypot(p.x, p.y).toFixed(1)} cm`;
  if (drag && drag.id === e.pointerId) {
    const ph = scanner.phantom, b = ph.body, r = drag.region, max = b.r - r.r - 0.2;
    let x = p.x, y = p.y; const d = Math.hypot(x - b.x, y - b.y);
    if (d > max) {x = b.x + (x - b.x) * max / d; y = b.y + (y - b.y) * max / d;}
    r.x = x; r.y = y; ph.prepare(); clearData();
  }
});
const endDrag = e => {if (drag && drag.id === e.pointerId) {drag = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);}};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => {cursor = null; $('cursorReadout').textContent = 'Move pointer onto canvas';});

// ---- CSV export ------------------------------------------------------------------------------
function download() {
  const header = 'time_ns,crystal1,crystal2,ring1,ring2,x1_cm,y1_cm,z1_cm,x2_cm,y2_cm,z2_cm,bed_cm,dt_ns,E1_keV,E2_keV,type,true_x_cm,true_y_cm,true_z_cm';
  const f = (v, d) => v?.toFixed(d) ?? '';
  const rows = scanner.events.map(e => [e.t.toFixed(4), e.c1, e.c2, e.r1, e.r2, f(e.x1, 3), f(e.y1, 3), f(e.z1, 3), f(e.x2, 3), f(e.y2, 3), f(e.z2, 3),
    e.bed, e.dt.toFixed(5), e.E1.toFixed(2), e.E2.toFixed(2), e.type, f(e.ax, 4), f(e.ay, 4), f(e.az, 4)].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `pet_listmode_${scanner.phantom.name}_${scanner.config.isotope}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Loop --------------------------------------------------------------------------------------
function updateImage() {
  const mode = $('recon').value, t = performance.now(), useAC = $('attenCorr').checked;
  const img = recon.reconstruct(mode, {useAC, ctrPs: scanner.config.timingResolution, mlemIterations: 6});
  const evs = recon.sino.reduce((a, b) => a + b, 0);
  const sub = `${evs.toLocaleString()} events in slice` + (mode === 'mlem' ? ` · ${recon.mlemIterations} iterations` : '') +
    (mode.startsWith('tof') ? ` · CTR ${scanner.config.timingResolution} ps` : '') + (useAC ? ' · AC on' : ' · no AC');
  const showRoi = lastCnr && Math.abs(lastCnr.z - viewZ) < 0.5;
  drawImage($('image'), img, recon.nPix, `${RECON_NAMES[mode]}, z = ${viewZ.toFixed(1)} cm`, sub, showRoi ? {cnr: lastCnr, fov: recon.fov} : null);
  drawSinogram($('sinogram'), recon.sino, recon.nAngles, recon.nS);
  drawSpectrum($('spectrum'), scanner.spectrum, scanner.config.windowLow, scanner.config.windowHigh);
  reconMs = performance.now() - t;
  imageDirty = false;
}

function frame(ms) {
  const now = ms / 1000, dt = lastTime ? clamp(now - lastTime, 0, 0.1) : 0; lastTime = now;
  if (dt > 0) fps = 0.94 * fps + 0.06 / dt;
  if (!paused) {
    const t = performance.now();
    const want = flags.animate && animator.ready;
    const featured = scanner.acquire(SPEEDS[clamp(Math.round(n('speed')), 0, SPEEDS.length - 1)], {recordFirst: want});
    if (featured) animator.start(featured);
    physicsMs = performance.now() - t;
    imageDirty = true;
  }
  animator.update(dt);
  for (let i = 0; i < scanner.crystalHits.length; i++) scanner.crystalHits[i] *= 0.9;
  for (let i = 0; i < scanner.ringHits.length; i++) scanner.ringHits[i] *= 0.9;
  renderer.draw(scanner, flags, animator, cursor, viewZ);
  sideRenderer.draw(scanner, flags, animator, viewZ);
  reconTimer += dt; hudTimer += dt; cnrTimer += dt; coronalTimer += dt;
  const mode = $('recon').value, reconEvery = mode === 'tofmlem' ? 3 : mode === 'mlem' || mode === 'tof' ? 1.0 : 0.5;
  if (imageDirty && (reconTimer > reconEvery || paused && reconTimer > 0.3)) {reconTimer = 0; updateImage();}
  if (coronalTimer > 2) {
    coronalTimer = 0;
    drawCoronal($('coronal'), recon.reconstructVolume($('attenCorr').checked), recon, scanner.phantom.target?.y ?? 0, {viewZ});
  }
  if (flags.liveCnr && !paused && cnrTimer > 3) {cnrTimer = 0; measureCnr();}
  if (hudTimer > 0.2) {
    hudTimer = 0;
    updatePetHUD($('hud'), scanner, recon, {fps, physicsMs, reconMs});
    $('eventCaption').textContent = flags.animate ? animator.caption() : 'Slow-motion replay is off.';
  }
  requestAnimationFrame(frame);
}

function resize() {
  for (const [cv, cam, view] of [[canvas, camera, VIEW], [side, sideCamera, SIDE_VIEW]]) {
    const rect = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(rect.width * dpr)); cv.height = Math.max(1, Math.round(rect.height * dpr));
    cam.setView(view);
  }
}

wireControls({change, pause: togglePause, step, clear: clearData, speed: speedKey, slice: sliceKey, addLesion: addLesionRandom,
  removeLesions, download, gotoTumor, measureCnr});
readConfig();
change('isotope');
setPhantom('tumor');
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
