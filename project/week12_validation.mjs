// Independent Week 12 numerical validation, with measured values for PROGRESS.md.
import assert from 'node:assert/strict';
import {rng} from './engine/random.js';
import {annihilate} from './engine/annihilation.js';
import {Scanner} from './engine/scanner.js';
import {PHANTOMS} from './engine/phantom.js';
import {FixedStepAccumulator} from './runtime/fixedStep.js';
import {conservativeConfig} from './runtime/conservative.js';

const fmt = n => Number(n).toExponential(4);
const rand = rng(2026);
let maxEnergyAbs = 0, maxMomentumAbs = 0;
for (let i = 0; i < 20000; i++) {
  const a = annihilate(rand);
  maxEnergyAbs = Math.max(maxEnergyAbs, Math.abs(a.energyError));
  maxMomentumAbs = Math.max(maxMomentumAbs, a.momentumError);
}
const tolE = 1e-9, tolP = 1e-9;
assert.ok(maxEnergyAbs < tolE && maxMomentumAbs < tolP);
console.log(`TEST 1: 20,000 events, max energy closure ${fmt(maxEnergyAbs)} keV (< ${tolE}); max momentum closure ${fmt(maxMomentumAbs)} keV/c (< ${tolP}) — PASS`);

function getTrues(eff) {
  const sc = new Scanner(PHANTOMS.uniform.make(), {efficiency: eff, activity: 1e5}, 8);
  sc.acquire(600000);sc.acquire(0,{flush:true});return sc.counts.trues;
}
const nHalf = getTrues(0.5), nFull = getTrues(1), ratio = nHalf/nFull;
assert.ok(Math.abs(ratio-0.25)<0.02);
console.log(`TEST 2: efficiency ε=0.5 gives ${nHalf} trues, ε=1 gives ${nFull}; ratio=${ratio.toFixed(5)} (expected 0.25 ± 0.02) — PASS`);

function ticks(fps, seconds=1) {
  const f = new FixedStepAccumulator(); let count = 0;
  for(let i=0;i<fps*seconds;i++) f.advance(1/fps, ()=>count++);
  return {count, lost:f.droppedSeconds};
}
const measured = [30,60,120].map(fps=>({fps,...ticks(fps)}));
assert.deepEqual(measured.map(x=>x.count),[60,60,60]);
console.log(`TEST 3: fixed step, one wall-second at 30/60/120 render FPS → ${measured.map(x=>x.count).join('/')} ticks (60/60/60 expected) — PASS`);

const cfg = conservativeConfig({activity: 1e5, efficiency: 0.4, attenuation: true, scatter: true, energyResolution: 0.15, positronRange: true, nonCollinearity: true});
assert.equal(cfg.efficiency,1);assert.equal(cfg.attenuation,false);assert.equal(cfg.scatter,false);assert.equal(cfg.positronRange,false);assert.equal(cfg.nonCollinearity,false);assert.equal(cfg.energyResolution,0);
const ann=annihilate(rng(5),{nonCollinearity:cfg.nonCollinearity});
assert.ok(ann.energyError===0 || Math.abs(ann.energyError)<1e-12);
assert.ok(ann.momentumError<1e-12);
console.log(`TEST 4: conservative mode disables all losses, 511+511 keV, energy closure ${fmt(Math.abs(ann.energyError))} keV, momentum closure ${fmt(ann.momentumError)} keV/c — PASS`);
