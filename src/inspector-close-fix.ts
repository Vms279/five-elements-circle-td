function installTowerInspectorCloseFix(){
  const inspector=document.querySelector<HTMLDivElement>('#towerInspector');
  if(!inspector){window.setTimeout(installTowerInspectorCloseFix,50);return;}
  if(inspector.dataset.closeFixInstalled==='1')return;
  inspector.dataset.closeFixInstalled='1';
  const close=()=>{
    inspector.classList.add('hidden');
  };
  inspector.addEventListener('pointerdown',(event)=>{
    const target=event.target as HTMLElement|null;
    if(!target?.closest('#closeTower'))return;
    event.preventDefault();
    event.stopPropagation();
    close();
  },true);
  inspector.addEventListener('click',(event)=>{
    const target=event.target as HTMLElement|null;
    if(!target?.closest('#closeTower'))return;
    event.preventDefault();
    event.stopPropagation();
    close();
  },true);
}
installTowerInspectorCloseFix();
