type TowerPlacementState={available:number;known:boolean};
const inventory=new Map<string,TowerPlacementState>();
let activePlacement:string|null=null;
let pointerDownTowerCount=0;

function getElement(button:HTMLButtonElement){return button.dataset.e||button.dataset.pick||'';}
function towerCount(){
  const text=document.querySelector('#runInfo')?.textContent||'';
  const m=text.match(/塔\s*(\d+)/);
  return m?Number(m[1]):0;
}
function syncPalette(){
  document.querySelectorAll<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]').forEach(button=>{
    const e=getElement(button);
    if(!e)return;
    let state=inventory.get(e);
    if(!state){
      state={available:1,known:true};
      inventory.set(e,state);
    }
    const available=state.available>0;
    button.disabled=!available;
    button.style.opacity=available?'1':'.35';
    button.style.pointerEvents=available?'auto':'none';
    button.dataset.available=String(state.available);
    const small=button.querySelector('small');
    if(small){
      small.textContent=available?` · 可放置 ×${state.available}`:' · 本轮已放置';
    }
  });
}

document.addEventListener('click',(event)=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]');
  if(!button)return;
  const e=getElement(button),state=inventory.get(e);
  if(!state||state.available<=0){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  activePlacement=e;
},true);

const canvas=document.querySelector<HTMLCanvasElement>('#game');
if(canvas){
  canvas.addEventListener('pointerdown',()=>{
    if(!activePlacement)return;
    pointerDownTowerCount=towerCount();
  },true);
  canvas.addEventListener('pointerup',()=>{
    const e=activePlacement;
    if(!e)return;
    window.setTimeout(()=>{
      const after=towerCount();
      const state=inventory.get(e);
      if(!state)return;
      if(after>pointerDownTowerCount){
        state.available=Math.max(0,state.available-1);
        activePlacement=null;
        syncPalette();
        return;
      }
      const runText=document.querySelector('#runInfo')?.textContent||'';
      if(!runText.includes(`正在放置：${e}塔`))activePlacement=null;
    },0);
  },true);
}

const observer=new MutationObserver(syncPalette);
observer.observe(document.body,{childList:true,subtree:true});
setInterval(syncPalette,100);
syncPalette();
