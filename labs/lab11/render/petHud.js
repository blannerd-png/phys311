// Numbers panel (same row layout as the Lab 9 diagnostics HUD).
const fmt = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString(undefined, {maximumFractionDigits: d, minimumFractionDigits: d}) : '–';
const rate = r => r >= 1e6 ? `${fmt(r / 1e6, 2)} M/s` : r >= 1e3 ? `${fmt(r / 1e3, 1)} k/s` : `${fmt(r, 0)} /s`;

export function updatePetHUD(el, scanner, recon, perf) {
  const s = scanner.stats(), c = scanner.config;
  const rows = [
    ['Simulated scan time', `${fmt(s.seconds * 1e3, 1)} ms`],
    ['Decays simulated', fmt(s.decays)],
    ['Singles rate (in window)', rate(s.singlesRate)],
    ['Coincidence window', `${fmt(scanner.window, 2)} ns`],
    null,
    ['Prompt coincidences', fmt(s.prompts)],
    ['Trues', fmt(s.trues), 'good'],
    ['Randoms', `${fmt(s.randoms)} (${fmt(100 * s.randomFraction, 1)} %)`, s.randomFraction > 0.3 ? 'warn' : ''],
    ['Scatters', `${fmt(s.scatters)} (${fmt(100 * s.scatterFraction, 1)} %)`, s.scatterFraction > 0.3 ? 'warn' : ''],
    ['Multiples (discarded)', fmt(s.multiples)],
    ['Outside FOV / ring diff.', `${fmt(s.outsideFov)} / ${fmt(s.ringDiff)}`],
    ['NECR = T²/(T+S+R)', rate(s.necr)],
    null,
    ['Events in view slice', fmt(recon.sino.reduce((a, b) => a + b, 0))],
    ['Frame rate', `${fmt(perf.fps, 0)} fps`],
    ['Physics / recon time', `${fmt(perf.physicsMs, 1)} / ${fmt(perf.reconMs, 0)} ms`]
  ];
  el.innerHTML = '<div class="hudTitle">Acquisition</div>' + rows.map(r => r ? `<div class="hudRow"><span class="hudLabel">${r[0]}</span><span class="hudValue ${r[2] ?? ''}">${r[1]}</span></div>` : '<div class="hudDivider"></div>').join('');
}
