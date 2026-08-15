type TowerPlacementState={available:number};
const inventory=new Map<string,TowerPlacementState>();
let activePlacement:string|null=null;
let placementStartCount=0;
let lastTowerCount=0;
let initialized=false;

function getElement(button:HTMLButtonElement){return button.dataset.e||button.dataset.pick||'';}

function readTowerCount(){
  const text=document.querySelector('#runInfo')?.textContent||'';
  const match=text.match(/(\d+)\s*\/\s*5\s*towers?/i);
  return match?Number(match[1]):null;
}

function syncPalette(){
  document.querySelectorAll<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]').forEach(button=>{
    const e=getElement(button);
    if(!e)return;
    let state=inventory.get(e);
    if(!state){
      state={available:1};
      inventory.set(e,state);
    }
    const available=state.available>0;
    button.disabled=!available;
    button.style.opacity=available?'1':'.35';
    button.style.pointerEvents=available?'auto':'none';
    button.dataset.available=String(state.available);
  });
}

function observePlacement(){
  const count=readTowerCount();
  if(count===null)return;
  if(initialized&&count===0&&lastTowerCount>0){
    inventory.clear();
    activePlacement=null;
    syncPalette();
  }
  initialized=true;
  lastTowerCount=count;
}

document.addEventListener('click',(event)=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]');
  if(!button)return;
  const e=getElement(button);
  const state=inventory.get(e);
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
    if(activePlacement===null)return;
    placementStartCount=readTowerCount()??lastTowerCount;
  },true);

  canvas.addEventListener('pointerup',()=>{
    const element=activePlacement;
    if(element===null)return;
    window.setTimeout(()=>{
      const after=readTowerCount();
      if(after!==null&&after>placementStartCount){
        const state=inventory.get(element);
        if(state)state.available=Math.max(0,state.available-1);
        activePlacement=null;
        lastTowerCount=after;
        syncPalette();
      }
    },0);
  },true);
}

const observer=new MutationObserver(()=>{observePlacement();syncPalette();});
observer.observe(document.body,{childList:true,subtree:true});
setInterval(()=>{observePlacement();syncPalette();},100);
syncPalette();
