// Toggle between the simulator and the explanatory physics page without reloading.
// As a result, detector settings and collected coincidences are preserved.
const simulator = document.getElementById('simulationView');
const physics = document.getElementById('physicsView');
const tabs = [...document.querySelectorAll('.page-tab')];
const simulationFooter = document.getElementById('simulationFooter');

function refreshLiveValues() {
  const lookup = (id) => document.getElementById(id);
  const efficiency = Number(lookup('efficiency').value) / 100;
  lookup('physicsLiveActivity').textContent = lookup('activityValue').textContent;
  lookup('physicsLiveEfficiency').textContent = `${Math.round(efficiency * 100)} %`;
  lookup('physicsLivePairs').textContent = `${(efficiency * efficiency * 100).toFixed(1)} %`;
  // ctrValue contains the actual mapped CTR in ps or ns, plus TOF spatial width.
  lookup('physicsLiveTiming').textContent = lookup('ctrValue').textContent.split(' (')[0];
}

function isPhysicsRoute() { return location.hash.startsWith('#physics'); }

function showPage(page, updateHistory = false) {
  const isPhysics = page === 'physics';
  simulator.hidden = isPhysics;
  physics.hidden = !isPhysics;
  if (simulationFooter) simulationFooter.hidden = isPhysics;
  tabs.forEach(tab => {
    const active = tab.dataset.page === (isPhysics ? 'physics' : 'simulation');
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  document.title = isPhysics ? 'Simulation Details: The Physics | PET scanner' : 'PET scanner: can it find the tumor?';
  if (isPhysics) refreshLiveValues();
  if (updateHistory && location.hash !== (isPhysics ? '#physics' : '#simulation')) {
    history.pushState({page}, '', isPhysics ? '#physics' : '#simulation');
  }
  // Re-size canvases when returning: a hidden canvas reports zero width during resize.
  if (!isPhysics) window.dispatchEvent(new Event('resize'));
  if (updateHistory) window.scrollTo({top: 0, behavior: 'instant'});
}

document.querySelectorAll('[data-page], [data-go-page]').forEach(el => {
  el.addEventListener('click', () => showPage(el.dataset.page || el.dataset.goPage, true));
});
window.addEventListener('popstate', () => showPage(isPhysicsRoute() ? 'physics' : 'simulation'));
window.addEventListener('hashchange', () => showPage(isPhysicsRoute() ? 'physics' : 'simulation'));
showPage(isPhysicsRoute() ? 'physics' : 'simulation');

// A physics card's section link never changes the active page, only the scroll target.
// Continue acquisition even while the explanatory page is open.
