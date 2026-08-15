function installInspectorFix(){
  const inspector=document.querySelector<HTMLDivElement>('#towerInspector');
  const canvas=document.querySelector<HTMLCanvasElement>('#game');
  if(!inspector||!canvas){window.setTimeout(installInspectorFix,50);return;}

  inspector.style.pointerEvents='auto';
  inspector.style.zIndex='50';
  inspector.style.touchAction='manipulation';

  const clearSelectionThroughCanvas=()=>{
    const r=canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,cancelable:true,clientX:r.left+5,clientY:r.top+5,pointerId:999,
      pointerType:'mouse',button:0,buttons:1
    }));
  };
  const close=()=>{
    inspector.classList.add('hidden');
    clearSelectionThroughCanvas();
  };

  const handle=(event:Event)=>{
    const target=event.target as HTMLElement|null;
    const button=target?.closest<HTMLButtonElement>('#closeTower');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    if('stopImmediatePropagation' in event)event.stopImmediatePropagation();
    close();
  };

  inspector.addEventListener('pointerdown',handle,true);
  inspector.addEventListener('pointerup',handle,true);
  inspector.addEventListener('click',handle,true);

  const observer=new MutationObserver(()=>{
    const button=inspector.querySelector<HTMLButtonElement>('#closeTower');
    if(button){
      button.style.pointerEvents='auto';
      button.style.touchAction='manipulation';
      button.style.position='relative';
      button.style.zIndex='100';
    }
  });
  observer.observe(inspector,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
};
installInspectorFix();
