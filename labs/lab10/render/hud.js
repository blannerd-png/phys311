
export function updateHUD(el, world, { fps = 0, physicsMs = 0, renderMs = 0, E0 = 0, scene = '' } = {}) {
  const energy = world.totalEnergy();
  const momentum = world.totalMomentum().length();
  const drift = Math.abs(E0) > 1e-12 ? 100 * (energy - E0) / Math.abs(E0) : 0;
  const number = (value, digits) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const row = (label, value, extraClass = '') =>
    `<div class="hudRow"><span class="hudLabel">${label}</span><span class="hudValue ${extraClass}">${value}</span></div>`;

  el.innerHTML =
    `<div class="hudTitle">${scene === 'billiards' ? 'Billiards' : scene === 'nbody' ? 'N-body gravity' : 'Spring network'} · Conservation HUD</div>` +
    row('Time', `${number(world.time, 2)} s`) +
    row('Bodies', String(world.bodies.length)) +
    row('Total energy', number(energy, 5)) +
    row('Energy drift', `${drift >= 0 ? '+' : ''}${number(drift, 4)}%`, Math.abs(drift) > 1 ? 'warn' : 'good') +
    row('Momentum |p|', number(momentum, 6)) +
    `<div class="hudDivider"></div>` +
    row('FPS', number(fps, 1)) +
    row('Physics time', `${number(physicsMs, 2)} ms`) +
    row('Render time', `${number(renderMs, 2)} ms`);
}
