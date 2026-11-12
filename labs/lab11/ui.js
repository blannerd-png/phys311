// Control wiring (same pattern as Lab 10 ui.js): no physics here, just events → actions.
export const $ = id => document.getElementById(id);

export const SPEEDS = [1, 10, 100, 1000, 5000, 20000, 50000];          // decays simulated per frame
export const activityFromSlider = v => 10 ** (5 + 3.3 * v / 100);     // 1e5 … 2e8 decays/s
export const ctrFromSlider = v => Math.round(100 * 320 ** (v / 100)); // 100 ps … 32 ns (log scale)
export const sliderFromCtr = ps => 100 * Math.log(ps / 100) / Math.log(320);

export const CHANGE_IDS = ['phantom', 'isotope', 'recon', 'ringMode'];
export const CHECK_IDS = ['positronRange', 'nonCollinearity', 'attenuation', 'scatter', 'attenCorr', 'autoWindow',
  'lors', 'animate', 'inset', 'liveCnr'];
export const SLIDER_IDS = ['activity', 'efficiency', 'ctr', 'coincWindow', 'windowLow', 'energyRes', 'rings', 'beds',
  'bedStep', 'tumorRatio', 'tumorRadius', 'tumorZ', 'viewZ', 'speed'];

export function wireControls(actions) {
  for (const id of [...CHANGE_IDS, ...CHECK_IDS]) $(id).addEventListener('change', () => actions.change(id));
  for (const id of SLIDER_IDS) $(id).addEventListener('input', () => actions.change(id));
  $('pause').addEventListener('click', actions.pause);
  $('step').addEventListener('click', actions.step);
  $('clear').addEventListener('click', actions.clear);
  $('addLesion').addEventListener('click', actions.addLesion);
  $('removeLesions').addEventListener('click', actions.removeLesions);
  $('gotoTumor').addEventListener('click', actions.gotoTumor);
  $('measureCnr').addEventListener('click', actions.measureCnr);
  $('downloadCSV').addEventListener('click', actions.download);
  window.addEventListener('keydown', e => {
    const tag = e.target?.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') {e.preventDefault(); actions.pause();}
    if (e.code === 'Period') {e.preventDefault(); actions.step();}
    if (e.code === 'KeyR') {e.preventDefault(); actions.clear();}
    if (e.code === 'Minus') {e.preventDefault(); actions.speed(-1);}
    if (e.code === 'Equal') {e.preventDefault(); actions.speed(1);}
    if (e.code === 'BracketLeft') {e.preventDefault(); actions.slice(-1);}
    if (e.code === 'BracketRight') {e.preventDefault(); actions.slice(1);}
  });
}
