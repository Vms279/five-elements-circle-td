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
  });
}

// Every acquired card is independent. Selecting A/B/C never depends on which
// card was acquired last, and any unplaced card can be placed in any order.
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

// Set the requested tower before the game's canvas placement handler runs.
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

// Observe only DOM insertions. syncTowerCards changes styles/attributes, not
// child nodes, so this cannot recurse into an observer/render loop.
const observer=new MutationObserver(()=>syncTowerCards());
observer.observe(document.body,{childList:true,subtree:true});

syncTowerCards();
