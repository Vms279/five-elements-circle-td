const inspectorFix=()=>{
  const inspector=document.querySelector<HTMLDivElement>('#towerInspector');
  const canvas=document.querySelector<HTMLCanvasElement>('#game');
  if(!inspector||!canvas){window.setTimeout(inspectorFix,50);return;}
  let suppressed=false;
  const close=()=>{suppressed=true;inspector.classList.add('hidden');};
  const clearSuppression=()=>{suppressed=false;};
  inspector.addEventListener('pointerdown',(event)=>{
    const target=event.target as HTMLElement|null;
    if(target?.closest('#closeTower')){event.preventDefault();event.stopPropagation();close();}
  },true);
  inspector.addEventListener('click',(event)=>{
    const target=event.target as HTMLElement|null;
    if(target?.closest('#closeTower')){event.preventDefault();event.stopPropagation();close();}
  },true);
  canvas.addEventListener('pointerdown',()=>clearSuppression(),true);
  const observer=new MutationObserver(()=>{if(suppressed)inspector.classList.add('hidden');});
  observer.observe(inspector,{attributes:true,attributeFilter:['class'],childList:true});
};
inspectorFix();
