// Text diagnostics, using the Lab 9/10 HUD row layout.
const row = (label, value, cls = '') =>
  `<div class="hudRow"><span class="hudLabel">${label}</span><span class="hudValue ${cls}">${value}</span></div>`;
const fmt = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString(undefined, {minimumFractionDigits: d, maximumFractionDigits: d}) : '—';
const rate = v => v >= 1e6 ? `${fmt(v / 1e6, 2)} M/s` : v >= 1e3 ? `${fmt(v / 1e3, 1)} k/s` : `${fmt(v, 0)} /s`;

export function updatePetHUD(el, scanner, recon, perf) {
  const s = scanner.stats(), ann = scanner.lastAnnihilation;
  const eErr = ann ? Math.abs(ann.energyError) : 0, pErr = ann ? ann.momentumError : 0;
  const ok = eErr < 1e-9 && pErr < 1e-9;
  el.innerHTML =
    `<div class="hudTitle">Acquisition</div>` +
    row('Scan time (simulated)', `${fmt(s.seconds * 1000, 2)} ms`) +
    row('Decays', fmt(s.decays)) +
    row('Prompt coincidences', `${fmt(s.prompts)} (${rate(s.promptRate)})`) +
    row('<span class="sw true"></span>Trues', fmt(s.trues)) +
    row('<span class="sw scatter"></span>Scatters', `${fmt(s.scatters)} · SF ${fmt(100 * s.scatterFraction, 1)}%`) +
    row('<span class="sw random"></span>Randoms', `${fmt(s.randoms)} · ${fmt(100 * s.randomFraction, 1)}% of prompts`) +
    row('Multiples discarded', fmt(s.multiples)) +
    row('NECR (image quality)', rate(s.necr)) +
    row('Events in image', fmt(recon.count)) +
    `<div class="hudDivider"></div><div class="hudTitle">Conservation at annihilation</div>` +
    row('E₁ + E₂ − E<sub>pair</sub>', `${eErr.toExponential(1)} keV`, ok ? 'good' : 'warn') +
    row('|p₁ + p₂ − p<sub>pair</sub>|', `${pErr.toExponential(1)} keV/c`, ok ? 'good' : 'warn') +
    row('Status', ok ? '✓ conserved' : '⚠ check', ok ? 'good' : 'warn') +
    row('Last pair angle', ann ? `${fmt(180 - ann.deviationDeg, 3)}°` : '—') +
    row('Photon energies', ann ? `${fmt(ann.photons[0].E, 2)} + ${fmt(ann.photons[1].E, 2)} keV` : '—') +
    `<div class="hudDivider"></div>` +
    row('FPS', fmt(perf.fps, 0)) +
    row('Physics / recon', `${fmt(perf.physicsMs, 1)} / ${fmt(perf.reconMs, 0)} ms`);
}
