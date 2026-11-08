export const $=id=>document.getElementById(id);

export function wireControls(actions) {
  for(const id of ['scene','count','integrator','mode']) $(id).addEventListener('change',()=>actions.change(id));
  for(const id of ['restitution','gravity','drag','springK','speed']) $(id).addEventListener('input',()=>actions.change(id));
  for(const id of ['trails','vectors','forceVectors','flash','energyChart']) $(id).addEventListener('change',()=>actions.change(id));
  $('pause').addEventListener('click',actions.pause);
  $('step').addEventListener('click',actions.step);
  $('reset').addEventListener('click',actions.reset);
  $('benchmark').addEventListener('click',actions.benchmark);
  window.addEventListener('keydown',e=>{
    const tag=e.target?.tagName;
    if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(tag)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.code==='Space'){e.preventDefault();actions.pause();}
    if(e.code==='Period'){e.preventDefault();actions.step();}
    if(e.code==='KeyR'){e.preventDefault();actions.reset();}
    if(e.code==='Minus'){e.preventDefault();actions.speed(-0.25);}
    if(e.code==='Equal'){e.preventDefault();actions.speed(0.25);}
  });
}
