const choicesRoot = document.querySelector<HTMLDivElement>('#choices');

if (choicesRoot) {
  choicesRoot.style.pointerEvents = 'auto';
  choicesRoot.style.touchAction = 'manipulation';
  choicesRoot.style.position = 'relative';
  choicesRoot.style.zIndex = '100';

  let handledPointer = false;

  const activateChoice = (target: EventTarget | null, event: Event) => {
    const button = (target as HTMLElement | null)?.closest<HTMLButtonElement>('.choice');
    if (!button || button.disabled) return;

    event.preventDefault();
    event.stopPropagation();

    const handler = (button as HTMLButtonElement & { onclick?: (ev: MouseEvent) => void }).onclick;
    if (typeof handler === 'function') {
      handler.call(button, new MouseEvent('click', {
        bubbles: false,
        cancelable: true,
        view: window,
      }));
    }
  };

  choicesRoot.addEventListener('pointerdown', (event) => {
    const isPrimaryMouse = event.pointerType === 'mouse' && event.button === 0;
    const isTouchOrPen = event.pointerType !== 'mouse';
    if (isPrimaryMouse || isTouchOrPen) {
      handledPointer = true;
      activateChoice(event.target, event);
    }
  }, true);

  choicesRoot.addEventListener('click', (event) => {
    if (handledPointer) {
      event.preventDefault();
      event.stopPropagation();
      handledPointer = false;
      return;
    }
    activateChoice(event.target, event);
  }, true);
}
