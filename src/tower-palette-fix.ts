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
  if(buttons.dataset.key===key)return;
  buttons.dataset.key=key;
  buttons.innerHTML=source.map(b=>`<button type="button" class="tower-pick" data-pick="${b.dataset.e}" style="--tower-color:${b.querySelector('i')?.getAttribute('style')?.match(/background:([^;]+)/)?.[1]||'#fff'}">${b.querySelector('i')?.textContent||''} ${b.dataset.e}</button>`).join('');
  buttons.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b=>b.addEventListener('click',()=>{
    const target=build.querySelector<HTMLButtonElement>(`[data-e="${b.dataset.pick}"]`);
    target?.click();
  }));
}
setInterval(installTowerPalette,250);
installTowerPalette();
