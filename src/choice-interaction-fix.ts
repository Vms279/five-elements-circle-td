const choicesRoot = document.querySelector<HTMLDivElement>('#choices');

if (choicesRoot) {
  choicesRoot.style.pointerEvents = 'auto';
  choicesRoot.style.touchAction = 'manipulation';
  choicesRoot.style.position = 'relative';
  choicesRoot.style.zIndex = '100';

  let handledPointer = -1;

  const activateChoice = (target: EventTarget | null, event: Event) => {
    const button = (target as HTMLElement | null)?.closest<HTMLButtonElement>('.choice');
    if (!button || button.disabled) return;

    event.preventDefault();
    event.stopPropagation();

    // The game creates the actual choice handler on each button. Invoke that
    // handler directly so a canvas/global pointer handler can never swallow it.
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
    if (event.pointerType !== 'mouse' || event.button === 0) {
      handledPointer = event.pointerId;
      activateChoice(event.target, event);
    }
  }, true);

  choicesRoot.addEventListener('click', (event) => {
    // Pointerdown already invoked the game handler. Suppress the follow-up
    // browser click so the selection is applied exactly once.
    if (handledPointer !== -1) {
      event.preventDefault();
      event.stopPropagation();
      handledPointer = -1;
      return;
    }
    activateChoice(event.target, event);
  }, true);

  choicesRoot.addEventListener('pointerup', () => {
    handledPointer = -1;
  }, true);
}
