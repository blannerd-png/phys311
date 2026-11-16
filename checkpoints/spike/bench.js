// Week 11 risk spike: can the PET engine hold 60 fps on a low-end machine?
// No UI, no rendering. Times only the two things that run inside a frame:
//   1. scanner.acquire(n)  — the per-frame physics (decay → positron → photons → sorter)
//   2. recon.reconstruct() — the image update that main.js runs every 0.5–1 s
// Shared by run.mjs (Node) and index.html (browser) so both report the same numbers.
import {Scanner} from '../engine/scanner.js';
import {PHANTOMS} from '../engine/phantom.js';
import {Reconstructor} from '../recon/reconstruction.js';

export const FRAME_MS = 1000 / 60;        // 16.7 ms per frame at 60 fps
export const RENDER_RESERVE_MS = 6;       // assumed cost of drawing the ring, LORs and panels (not measured here)
export const PHYSICS_BUDGET_MS = FRAME_MS - RENDER_RESERVE_MS;
export const HITCH_MS = 50;               // a single frame longer than this is a visible stutter

const now = () => performance.now();
const median = a => {const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)];};

function freshScanner() {
  const scanner = new Scanner(PHANTOMS.torso.make());   // torso, F-18, every physics switch on (DEFAULTS)
  const recon = new Reconstructor();
  recon.setAttenuationFromPhantom(scanner.phantom);
  scanner.onCoincidence = ev => recon.add(ev);
  return {scanner, recon};
}

// Test 1: physics cost per frame at each acquisition speed.
export function benchPhysics(batches = [100, 400, 1000, 2000, 4000], frames = 60) {
  const rows = [];
  for (const n of batches) {
    const {scanner} = freshScanner();
    for (let k = 0; k < 10; k++) scanner.acquire(n);           // warm-up so the JIT has compiled the hot loop
    const times = [];
    for (let k = 0; k < frames; k++) {const t = now(); scanner.acquire(n); times.push(now() - t);}
    const ms = median(times);
    rows.push({decaysPerFrame: n, msPerFrame: ms, usPerDecay: 1000 * ms / n, fitsBudget: ms <= PHYSICS_BUDGET_MS});
  }
  return rows;
}

// Test 2: one image update for each reconstruction mode, after a realistic amount of data.
export function benchRecon(targetEvents = [20000, 100000], repeats = 3) {
  const rows = [];
  for (const target of targetEvents) {
    const {scanner, recon} = freshScanner();
    while (recon.count < target) scanner.acquire(4000);
    for (const mode of ['bp', 'fbp', 'tof', 'mlem']) {
      const times = [];
      for (let r = 0; r < repeats; r++) {
        recon.mlemImage = null;                               // main.js resets this too, so MLEM restarts
        const t = now();
        recon.reconstruct(mode, {useAC: false, ctrPs: 400, mlemIterations: 2});
        times.push(now() - t);
      }
      const ms = median(times);
      rows.push({events: recon.count, mode, ms, hitch: ms > HITCH_MS});
    }
  }
  return rows;
}

export function runAll(log = console.log) {
  log(`Frame budget ${FRAME_MS.toFixed(1)} ms; physics budget ${PHYSICS_BUDGET_MS.toFixed(1)} ms after a ${RENDER_RESERVE_MS} ms render reserve.`);
  log('\nTest 1 - physics per frame (torso, F-18, all physics on)');
  const phys = benchPhysics();
  for (const r of phys) log(`  ${String(r.decaysPerFrame).padStart(5)} decays/frame: ${r.msPerFrame.toFixed(2).padStart(6)} ms  (${r.usPerDecay.toFixed(2)} us/decay)  ${r.fitsBudget ? 'OK' : 'OVER BUDGET'}`);
  const best = phys.filter(r => r.fitsBudget).pop();
  log(`  Largest speed that fits: ${best ? best.decaysPerFrame : 'none'} decays/frame`);

  log('\nTest 2 - one image update (runs every 0.5 s for BP/FBP, every 1 s for TOF/MLEM)');
  const rec = benchRecon();
  for (const r of rec) log(`  ${String(r.events).padStart(6)} events  ${r.mode.padEnd(4)}: ${r.ms.toFixed(1).padStart(7)} ms  ${r.hitch ? 'STUTTER' : 'OK'}`);
  return {phys, rec, best};
}
