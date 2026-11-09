// Control wiring (same pattern as Lab 10 ui.js): no physics here, just events → actions.
export const $ = id => document.getElementById(id);

export const SPEEDS = [1, 5, 25, 100, 400, 1500, 4000];       // decays simulated per frame
export const activityFromSlider = v => 10 ** (5 + 3.3 * v / 100); // 1e5 … 2e8 decays/s

export function wireControls(actions) {
  for (const id of ['phantom', 'isotope', 'recon']) $(id).addEventListener('change', () => actions.change(id));
  for (const id of ['positronRange', 'nonCollinearity', 'attenuation', 'scatter', 'attenCorr', 'lors', 'animate', 'inset'])
    $(id).addEventListener('change', () => actions.change(id));
  for (const id of ['activity', 'windowLow', 'energyRes', 'coincWindow', 'ctr', 'speed'])
    $(id).addEventListener('input', () => actions.change(id));
  $('pause').addEventListener('click', actions.pause);
  $('step').addEventListener('click', actions.step);
  $('clear').addEventListener('click', actions.clear);
  $('addLesion').addEventListener('click', actions.addLesion);
  $('removeLesions').addEventListener('click', actions.removeLesions);
  $('downloadCSV').addEventListener('click', actions.download);
  window.addEventListener('keydown', e => {
    const tag = e.target?.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') {e.preventDefault(); actions.pause();}
    if (e.code === 'Period') {e.preventDefault(); actions.step();}
    if (e.code === 'KeyR') {e.preventDefault(); actions.clear();}
    if (e.code === 'Minus') {e.preventDefault(); actions.speed(-1);}
    if (e.code === 'Equal') {e.preventDefault(); actions.speed(1);}
  });
}
