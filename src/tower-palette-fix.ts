function installTowerPalette(){
  const stage=document.querySelector<HTMLElement>('.sidepanel');
  const build=document.querySelector<HTMLElement>('#build');
  if(!stage||!build){window.setTimeout(installTowerPalette,100);return;}
  let panel=document.querySelector<HTMLElement>('#towerPalette');
  if(!panel){
    panel=document.createElement('section');
    panel.id='towerPalette';
    panel.className='panel tower-palette-panel';
    panel.innerHTML='<div class="panel-title">TOWER SELECT · 已解锁</div><div id="towerPaletteButtons" class="tower-palette-buttons"></div>';
    stage.insertBefore(panel,stage.children[1]||null);
  }
  const buttons=panel.querySelector<HTMLElement>('#towerPaletteButtons')!;
  const source=Array.from(build.querySelectorAll<HTMLButtonElement>('[data-e]'));
  const key=source.map(b=>b.dataset.e).join('|');
  if(buttons.dataset.key!==key){
    buttons.dataset.key=key;
    buttons.innerHTML=source.map(b=>`<button type="button" class="tower-pick" data-pick="${b.dataset.e}" style="--tower-color:${b.querySelector('i')?.getAttribute('style')?.match(/background:([^;]+)/)?.[1]||'#fff'}">${b.querySelector('i')?.textContent||''} ${b.dataset.e}</button>`).join('');
  }
  buttons.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b=>{
    if(b.dataset.bound==='1')return;
    b.dataset.bound='1';
    b.addEventListener('click',()=>{
      if(b.dataset.consumed==='1')return;
      const target=build.querySelector<HTMLButtonElement>(`[data-e="${b.dataset.pick}"]`);
      target?.click();
    });
  });
}
const consumed=new Set<string>();
let activePlacement:string|null=null;
function syncConsumed(){
  document.querySelectorAll<HTMLButtonElement>('#build [data-e]').forEach(b=>{
    const e=b.dataset.e||'';
    if(consumed.has(e)){b.dataset.consumed='1';b.disabled=true;b.style.opacity='.35';}
  });
  document.querySelectorAll<HTMLButtonElement>('#towerPalette [data-pick]').forEach(b=>{
    const e=b.dataset.pick||'';
    if(consumed.has(e)){b.dataset.consumed='1';b.disabled=true;b.style.opacity='.35';}
  });
}
document.addEventListener('click',(event)=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest<HTMLButtonElement>('#build [data-e], #towerPalette [data-pick]');
  if(!button)return;
  const e=button.dataset.e||button.dataset.pick||'';
  if(consumed.has(e)){event.preventDefault();event.stopImmediatePropagation();return;}
  activePlacement=e;
},true);
const gameCanvas=document.querySelector<HTMLCanvasElement>('#game');
if(gameCanvas){
  gameCanvas.addEventListener('pointerup',()=>{
    if(!activePlacement)return;
    window.setTimeout(()=>{
      const run=document.querySelector('#runInfo')?.textContent||'';
      if(!run.includes(`正在放置：${activePlacement}塔`)){
        consumed.add(activePlacement!);
        activePlacement=null;
        syncConsumed();
      }
    },0);
  },true);
}
const placementObserver=new MutationObserver(()=>syncConsumed());
placementObserver.observe(document.body,{childList:true,subtree:true});
setInterval(installTowerPalette,250);
setInterval(syncConsumed,150);
installTowerPalette();
