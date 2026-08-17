type TowerCardState={available:number};

const towerCards=new Map<string,TowerCardState>();
let selectedCard:string|null=null;
let placementTowerCountBefore=0;

function readPlacedTowerCount():number{
  const text=document.querySelector('#runInfo')?.textContent||'';
  const match=text.match(/塔\s*(\d+)\s*·\s*解锁/);
  return match?Number(match[1]):0;
}

function syncTowerCards(){
  document.querySelectorAll<HTMLButtonElement>('#build [data-e]').forEach(button=>{
    const element=button.dataset.e;
    if(!element)return;
    if(!towerCards.has(element))towerCards.set(element,{available:1});
    const state=towerCards.get(element)!;
    const enabled=state.available>0;
    button.disabled=!enabled;
    button.style.opacity=enabled?'1':'.38';
    button.style.pointerEvents=enabled?'auto':'none';
    button.dataset.cardAvailable=String(state.available);
    const small=button.querySelector('small');
    if(small)small.textContent=enabled?' · 可放置 ×1':' · 已放置';
  });
}

// The selected card is independent from every other card. A/B/C can be placed
// in any order; selecting B must never depend on which card was acquired last.
document.addEventListener('click',(event)=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest<HTMLButtonElement>('#build [data-e]');
  if(!button)return;
  const element=button.dataset.e;
  if(!element)return;
  const state=towerCards.get(element) || {available:1};
  towerCards.set(element,state);
  if(state.available<=0){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  selectedCard=element;
},true);

// IMPORTANT: maze.ts handles the canvas pointerdown itself. Document capture
// runs before the canvas capture/bubble handlers, so set maze.ts's `placing`
// state BEFORE its placement handler executes. The previous implementation did
// this on the canvas, which was one event too late and caused the newest card to
// be placed regardless of which card was selected.
document.addEventListener('pointerdown',(event)=>{
  if(selectedCard===null)return;
  if(!(event.target instanceof Element))return;
  if(!event.target.closest('#game'))return;
  const element=selectedCard;
  const button=document.querySelector<HTMLButtonElement>(`#build [data-e="${CSS.escape(element)}"]`);
  if(!button)return;
  placementTowerCountBefore=readPlacedTowerCount();
  button.click();
},true);

document.addEventListener('pointerup',(event)=>{
  if(selectedCard===null)return;
  if(!(event.target instanceof Element))return;
  if(!event.target.closest('#game'))return;
  const element=selectedCard;
  window.setTimeout(()=>{
    const after=readPlacedTowerCount();
    if(after>placementTowerCountBefore){
      const state=towerCards.get(element) || {available:1};
      state.available=Math.max(0,state.available-1);
      towerCards.set(element,state);
      selectedCard=null;
      syncTowerCards();
    }
  },0);
},true);

const observer=new MutationObserver(()=>syncTowerCards());
observer.observe(document.body,{childList:true,subtree:true});
setInterval(syncTowerCards,100);
syncTowerCards();
