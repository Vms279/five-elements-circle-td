function installTowerInspectorCloseFix(){
  const inspector=document.querySelector<HTMLDivElement>('#towerInspector');
  const canvas=document.querySelector<HTMLCanvasElement>('#game');
  if(!inspector||!canvas){window.setTimeout(installTowerInspectorCloseFix,50);return;}
  if(inspector.dataset.closeFixInstalled==='1')return;
  inspector.dataset.closeFixInstalled='1';
  inspector.addEventListener('click',(event)=>{
    const target=event.target as HTMLElement|null;
    const close=target?.closest('#closeTower');
    if(!close)return;
    event.preventDefault();
    event.stopPropagation();
    const rect=canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,
      cancelable:true,
      clientX:rect.right-4,
      clientY:rect.bottom-4,
      pointerId:999,
      pointerType:'mouse',
      isPrimary:true
    }));
  });
}
installTowerInspectorCloseFix();
