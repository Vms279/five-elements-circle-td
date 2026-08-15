const consumed=new Set<string>();
let activePlacement:string|null=null;

function getElement(button:HTMLButtonElement){return button.dataset.e||button.dataset.pick||'';}
function markConsumed(e:string){
  if(!e)return;
  consumed.add(e);
  document.querySelectorAll<HTMLButtonElement>(`#build [data-e="${e}"], #towerPalette [data-pick="${e}"]`).forEach(button=>{
    button.dataset.consumed='1';
    button.disabled=true;
    button.style.opacity='.35';
    button.style.pointerEvents='none';
  });
}
function syncPalette(){
  document.querySelectorAll<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]').forEach(button=>{
    const e=getElement(button);
    if(consumed.has(e)){
      button.dataset.consumed='1';
      button.disabled=true;
      button.style.opacity='.35';
      button.style.pointerEvents='none';
    }
  });
}

document.addEventListener('click',(event)=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]');
  if(!button)return;
  const e=getElement(button);
  if(consumed.has(e)){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  activePlacement=e;
},true);

const canvas=document.querySelector<HTMLCanvasElement>('#game');
if(canvas){
  canvas.addEventListener('pointerup',()=>{
    const e=activePlacement;
    if(!e)return;
    window.setTimeout(()=>{
      const runText=document.querySelector('#runInfo')?.textContent||'';
      // A successful placement clears the placing state in maze.ts.
      // An invalid placement keeps "正在放置：X塔", so the card remains available.
      if(!runText.includes(`正在放置：${e}塔`)){
        markConsumed(e);
        activePlacement=null;
      }
    },0);
  },true);
}

// Rebuilding the build panel happens during the game loop, so always re-apply the
// single-use state after DOM replacement. The capture listener above is the final guard.
const observer=new MutationObserver(syncPalette);
observer.observe(document.body,{childList:true,subtree:true});
setInterval(syncPalette,100);
syncPalette();
