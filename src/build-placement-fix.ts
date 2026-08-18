type ElementKey = '金'|'木'|'水'|'火'|'土';
const ELEMENTS: ElementKey[] = ['金','木','水','火','土'];
const cardCount = new Map<ElementKey, number>();
let activeCard: ElementKey | null = null;
let lastPlacedCount = 0;

const style = document.createElement('style');
style.textContent = `
#build{display:grid;grid-template-columns:1fr;gap:8px}
#build .tower-row{min-height:62px;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:linear-gradient(145deg,rgba(22,40,60,.95),rgba(10,20,34,.95));color:#e8f1fb;cursor:pointer;text-align:left;transition:transform .12s,border-color .12s,opacity .12s}
#build .tower-row:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(255,255,255,.25)}
#build .tower-row:disabled{cursor:not-allowed}
#build .tower-row i{width:34px;height:34px;border-radius:10px}
#build .tower-row span{display:flex;flex-direction:column;gap:3px;font-weight:700}
#build .tower-row small{font-size:9px;color:#7f96ad;font-weight:500}
`;
document.head.appendChild(style);

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
        ? (activeCard === e ? ' · 已选择 · 点击地图放置' : ` · 塔卡 ×${count} · 点击使用`)
        : ' · 塔卡已使用';
    }
    button.style.opacity = count > 0 ? '1' : '.35';
    button.disabled = count <= 0;
  });
}

// Native game click remains the single source of truth for entering placement.
// This controller only records which persistent card the player selected.
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
