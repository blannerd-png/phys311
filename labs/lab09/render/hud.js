export function updateHUD(el,world,{fps=0,physicsMs=0,renderMs=0,E0=0,scene=''}={}){
  const E=world.totalEnergy(),p=world.totalMomentum(),pm=p.length();
  const drift=Math.abs(E0)>1e-12?100*(E-E0)/Math.abs(E0):0;
  el.innerHTML=`<div class="hudTitle">${scene} · Conservation HUD</div>`+
    `<div>t = ${world.time.toFixed(2)} s &nbsp; | &nbsp; bodies = ${world.bodies.length}</div>`+
    `<div>Energy: ${E.toFixed(5)} &nbsp; Drift: <strong class="${Math.abs(drift)>1?'warn':'good'}">${drift.toFixed(4)}%</strong></div>`+
    `<div>Momentum |p| = ${pm.toFixed(6)} <span class="muted">(walls exert impulses)</span></div>`+
    `<div>FPS: ${fps.toFixed(1)} &nbsp; Physics: ${physicsMs.toFixed(2)} ms &nbsp; Render: ${renderMs.toFixed(2)} ms</div>`;
}
