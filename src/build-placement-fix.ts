type ElementKey = '金'|'木'|'水'|'火'|'土';

const cardInventory = new Map<ElementKey, number>();
let activeCard: ElementKey | null = null;
let placementStartedAt = 0;
let towerCountBefore = 0;

function elementFromButton(button: HTMLButtonElement): ElementKey | null {
  const value = button.dataset.e;
  return value && ['金','木','水','火','土'].includes(value) ? value as ElementKey : null;
}

function placedTowerCount(): number {
  const text = document.querySelector('#runInfo')?.textContent || '';
  const match = text.match(/塔\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function syncBuildButtons() {
  document.querySelectorAll<HTMLButtonElement>('#build .tower-row[data-e]').forEach((button) => {
    const e = elementFromButton(button);
    if (!e) return;
    if (!cardInventory.has(e)) cardInventory.set(e, 1);
    const available = (cardInventory.get(e) || 0) > 0;
    button.disabled = !available;
    button.style.pointerEvents = 'auto';
    button.style.cursor = available ? 'pointer' : 'not-allowed';
    button.style.opacity = available ? '1' : '.4';
  });
}

// The main game redraws the Build list frequently. Handle selection from a
// stable document-level pointer event and invoke the game's existing onclick
// directly, so the selected element is never lost during a DOM rebuild.
document.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('#build .tower-row[data-e]');
  if (!button) return;
  const e = elementFromButton(button);
  if (!e || (cardInventory.get(e) || 0) <= 0) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  activeCard = e;
  towerCountBefore = placedTowerCount();
  placementStartedAt = performance.now();
  button.onclick?.(new MouseEvent('click', { bubbles: false, cancelable: true }));
}, true);

// Suppress the browser's follow-up click because pointerdown already selected
// the card and called the game's original handler.
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('#build .tower-row[data-e]');
  if (!button) return;
  if (performance.now() - placementStartedAt < 350) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

const canvas = document.querySelector<HTMLCanvasElement>('#game');
canvas?.addEventListener('pointerup', () => {
  if (!activeCard) return;
  const e = activeCard;
  window.setTimeout(() => {
    if (placedTowerCount() > towerCountBefore) {
      cardInventory.set(e, Math.max(0, (cardInventory.get(e) || 1) - 1));
      activeCard = null;
      syncBuildButtons();
    }
  }, 0);
}, true);

const observer = new MutationObserver(syncBuildButtons);
observer.observe(document.body, { childList: true, subtree: true });
syncBuildButtons();
