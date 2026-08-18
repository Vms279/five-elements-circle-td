type ElementKey = '金'|'木'|'水'|'火'|'土';
const ELEMENTS: ElementKey[] = ['金','木','水','火','土'];
const cardCount = new Map<ElementKey, number>();
let activeCard: ElementKey | null = null;
let lastPlacedCount = 0;

function getPlacedCount(): number {
  const text = document.querySelector('#runInfo')?.textContent || '';
  const match = text.match(/塔\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getSelectedFromRun(): ElementKey | null {
  const text = document.querySelector('#runInfo')?.textContent || '';
  const match = text.match(/正在放置：([金木水火土])塔/);
  return match ? match[1] as ElementKey : null;
}

function ensureCard(e: ElementKey) {
  if (!cardCount.has(e)) cardCount.set(e, 1);
}

function renderCards() {
  document.querySelectorAll<HTMLButtonElement>('#build .tower-row[data-e]').forEach((button) => {
    const e = button.dataset.e as ElementKey | undefined;
    if (!e || !ELEMENTS.includes(e)) return;
    ensureCard(e);
    const count = cardCount.get(e) || 0;
    const small = button.querySelector('small');
    if (small) {
      small.textContent = count > 0
        ? (activeCard === e ? ' · 已选择，点击地图放置' : ` · 塔卡 ×${count} · 点击使用`)
        : ' · 塔卡已使用';
    }
    button.style.opacity = count > 0 ? '1' : '.35';
    button.style.cursor = count > 0 ? 'pointer' : 'not-allowed';
    button.disabled = count <= 0;
  });
}

// Do not intercept the game's native button click. The game owns the placing state;
// this controller only turns each unlocked tower into an independent persistent card.
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('#build .tower-row[data-e]');
  if (!button) return;
  const e = button.dataset.e as ElementKey | undefined;
  if (!e) return;
  ensureCard(e);
  if ((cardCount.get(e) || 0) <= 0) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  activeCard = e;
  renderCards();
}, false);

// The native game reports which card is currently selected. When the number of
// placed towers increases, consume only that selected card; other cards remain available.
function reconcilePlacement() {
  const selected = getSelectedFromRun();
  if (selected) activeCard = selected;
  const count = getPlacedCount();
  if (count > lastPlacedCount && activeCard) {
    const current = cardCount.get(activeCard) || 0;
    cardCount.set(activeCard, Math.max(0, current - 1));
    activeCard = null;
  }
  lastPlacedCount = count;
  renderCards();
}

const observer = new MutationObserver(reconcilePlacement);
observer.observe(document.body, { childList: true, subtree: true });
setInterval(reconcilePlacement, 100);

lastPlacedCount = getPlacedCount();
renderCards();
