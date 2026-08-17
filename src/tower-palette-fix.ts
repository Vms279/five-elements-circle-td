type TowerCardState={available:number};

const towerCards=new Map<string,TowerCardState>();
let selectedCard:string|null=null;
let placementTowerCountBefore=0;
let syncing=false;

function readPlacedTowerCount():number{
  const text=document.querySelector('#runInfo')?.textContent||'';
  const match=text.match(/塔\s*(\d+)\s*·\s*解锁/);
  return match?Number(match[1]):0;
}

function syncTowerCards(){
  if(syncing)return;
  syncing=true;
  try{
    document.querySelectorAll<HTMLButtonElement>('#build [data