import {Scanner} from './engine/scanner.js';
import {PHANTOMS} from './engine/phantom.js';
import {ISOTOPES} from './engine/positron.js';
import {Reconstructor} from './recon/reconstruction.js';
import {Camera} from './render/camera.js';
import {PetRenderer} from './render/petRenderer.js';
import {EventAnimator} from './render/eventAnimation.js';
import {drawImage, drawTruth, drawSinogram, drawSpectrum} from './render/panels.js';
import {updatePetHUD} from './render/petHud.js';
import {eventToWorld} from './input.js';
import {$, wireControls, SPEEDS, activityFromSlider} from './ui.js';

const VIEW = {xMin: -46, xMax: 46, yMin: -46, yMax: 46};
const canvas = $('sim'), camera = new Camera(canvas, VIEW), renderer = new PetRenderer(canvas, camera);
const recon = new Reconstructor();
const animator = new EventAnimator();
const scanner = new Scanner(PHANTOMS.torso.make());
scanner.onCoincidence = ev => recon.add(ev);

const flags = {lors: true, animate: true, inset: true};
const RECON_NAMES = {fbp: 'Filtered backprojection', bp: 'Simple backprojection', mlem: 'MLEM', tof: 'Time-of-flight backprojection'};
let paused = false, cursor = null, lastTime = 0, fps = 60, physicsMs = 0, reconMs = 0;
let reconTimer = 0, hudTimer = 0, imageDirty = true, drag = null;

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
  c.windowLow = clamp(n('windowLow'), 200, 500);
  c.energyResolution = clamp(n('energyRes'), 4, 25) / 100;
  c.coincidenceWindow = clamp(n('coincWindow'), 1, 20);
  c.timingResolution = clamp(n('ctr'), 100, 1000);
  refreshReadouts();
}

function refreshReadouts() {
  const c = scanner.config, A = c.activity;
  $('activityValue').textContent = A >= 1e6 ? `${(A / 1e6).toFixed(2)} M decays/s` : `${(A / 1e3).toFixed(0)} k decays/s`;
  $('windowLowValue').textContent = `${c.windowLow} – ${c.windowHigh} keV`;
  $('energyResValue').textContent = `${(c.energyResolution * 100).toFixed(0)}%`;
  $('coincWindowValue').textContent = `${c.coincidenceWindow.toFixed(1)} ns`;
  const tofCm = 29.98 * c.timingResolution / 1000 / 2;
  $('ctrValue').textContent = `${c.timingResolution} ps (≈${tofCm.toFixed(1)} cm along LOR)`;
  const sp = SPEEDS[clamp(Math.round(n('speed')), 0, SPEEDS.length - 1)];
  $('speedValue').textContent = `${sp} decay${sp > 1 ? 's' : ''}/frame`;
}

// Start a fresh acquisition (any change to the physics or scanner invalidates collected data).
function clearData() {
  scanner.reset(); recon.clear(); animator.event = null;
  recon.setAttenuationFromPhantom(scanner.phantom);
  imageDirty = true;
  drawTruth($('truth'), scanner.phantom, recon.fov);
}

function setPhantom(key) {
  scanner.setPhantom(PHANTOMS[key].make());
  $('phantomName').textContent = PHANTOMS[key].label;
  const editable = key === 'torso' || key === 'uniform';
  $('addLesion').disabled = !editable; $('removeLesions').disabled = !editable;
  clearData();
}

function change(id) {
  if (id === 'phantom') {setPhantom($('phantom').value); return;}
  if (id === 'isotope') {
    scanner.setIsotope($('isotope').value);
    $('isotopeName').textContent = `${ISOTOPES[$('isotope').value].name} · ${ISOTOPES[$('isotope').value].use}`;
    clearData(); return;
  }
  if (['lors', 'animate', 'inset'].includes(id)) {flags[id] = $(id).checked; return;}
  if (id === 'recon' || id === 'attenCorr') {recon.mlemImage = null; imageDirty = true; return;}
  if (id === 'speed') {refreshReadouts(); return;}
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

// ---- Lesion editing -------------------------------------------------------
function addLesionAt(x, y) {
  const ph = scanner.phantom, body = ph.body;
  if (ph.regions.filter(r => r.added).length >= 8) return;
  const r = 0.8, d = Math.hypot(x - body.x, y - body.y), max = body.r - r - 0.2;
  if (d > max) {x = body.x + (x - body.x) * max / d; y = body.y + (y - body.y) * max / d;}
  ph.regions.push({name: 'Added lesion', x, y, r, material: 'water', mu: 0.096, density: 1, conc: 8, movable: true, added: true});
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
  const hit = [...ph.regions].reverse().find(r => r.movable && Math.hypot(p.x - r.x, p.y - r.y) <= r.r + 0.6);
  if (hit) {drag = {region: hit, id: e.pointerId}; canvas.setPointerCapture(e.pointerId); return;}
  const editable = ph.name === 'torso' || ph.name === 'uniform';
  if (editable && Math.hypot(p.x - ph.body.x, p.y - ph.body.y) < ph.body.r) addLesionAt(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  const p = eventToWorld(e, canvas, camera); cursor = p;
  $('cursorReadout').textContent = `Cursor: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) cm · r = ${Math.hypot(p.x, p.y).toFixed(1)} cm`;
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

// ---- CSV export ------------------------------------------------------------
function download() {
  const header = 'time_ns,crystal1,crystal2,x1_cm,y1_cm,x2_cm,y2_cm,dt_ns,E1_keV,E2_keV,type,true_x_cm,true_y_cm';
  const rows = scanner.events.map(e => [e.t.toFixed(4), e.c1, e.c2, e.x1.toFixed(3), e.y1.toFixed(3), e.x2.toFixed(3), e.y2.toFixed(3),
    e.dt.toFixed(5), e.E1.toFixed(2), e.E2.toFixed(2), e.type, e.ax?.toFixed(4) ?? '', e.ay?.toFixed(4) ?? ''].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `pet_listmode_${scanner.phantom.name}_${scanner.config.isotope}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Loop ----------------------------------------------------------------
function updateImage() {
  const mode = $('recon').value, t = performance.now();
  if (mode === 'tof' && recon.count > 0 || mode !== 'tof') {
    const img = recon.reconstruct(mode, {useAC: $('attenCorr').checked, ctrPs: scanner.config.timingResolution, mlemIterations: 2});
    const sub = `${recon.count.toLocaleString()} events` + (mode === 'mlem' ? ` · ${recon.mlemIterations} iterations` : '') +
      ($('attenCorr').checked ? ' · AC on' : ' · no AC');
    drawImage($('image'), img, recon.nPix, `Reconstructed: ${RECON_NAMES[mode]}`, sub);
  }
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
  renderer.draw(scanner, flags, animator, cursor);
  reconTimer += dt; hudTimer += dt;
  const reconEvery = $('recon').value === 'mlem' || $('recon').value === 'tof' ? 1.0 : 0.5;
  if (imageDirty && (reconTimer > reconEvery || paused)) {reconTimer = 0; updateImage();}
  if (hudTimer > 0.2) {
    hudTimer = 0;
    updatePetHUD($('hud'), scanner, recon, {fps, physicsMs, reconMs});
    $('eventCaption').textContent = flags.animate ? animator.caption() : 'Slow-motion replay is off.';
  }
  requestAnimationFrame(frame);
}

function resize() {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
  camera.setView(VIEW);
}

wireControls({change, pause: togglePause, step, clear: clearData, speed: speedKey, addLesion: addLesionRandom, removeLesions, download});
$('activity').value = '50';
readConfig();
$('isotopeName').textContent = `${ISOTOPES['F-18'].name} · ${ISOTOPES['F-18'].use}`;
setPhantom('torso');
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
