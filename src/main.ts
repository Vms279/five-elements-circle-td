import './style.css';

type ElementType = '金' | '木' | '水' | '火' | '土';

type Tower = {
  element: ElementType;
  x: number;
  y: number;
  damage: number;
  cooldown: number;
  timer: number;
  range: number;
  color: string;
};

type Enemy = {
  id: number;
  t: number;
  hp: number;
  maxHp: number;
  speed: number;
  element: ElementType | null;
  kind: string;
  leak: number;
  xp: number;
  alive: boolean;
};

type Card = {
  title: string;
  description: string;
  apply: () => void;
};

const elements: ElementType[] = ['金', '木', '水', '火', '土'];
const colors: Record<ElementType, string> = { 金: '#f5c542', 木: '#59c878', 水: '#54b9ff', 火: '#ff7043', 土: '#c79a62' };
const icons: Record<ElementType, string> = { 金: '✦', 木: '✣', 水: '◈', 火: '◆', 土: '⬟' };
const counter: Record<ElementType, ElementType> = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };

const canvas = document.createElement('canvas');
canvas.id = 'game';
const root = document.querySelector<HTMLDivElement>('#root')!;
root.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">五</span><div><strong>FIVE ELEMENTS</strong><small>CIRCLE TD</small></div></div>
      <div class="stats">
        <div><span>TIME</span><b id="time">00:00</b></div>
        <div><span>LEVEL</span><b id="level">Lv.1</b></div>
        <div class="leak"><span>LEAK</span><b id="leak">0 / 20</b></div>
      </div>
    </header>
    <main class="stage">
      <div class="game-wrap">
        <div id="towerInspector" class="tower-inspector hidden"></div>
      </div>
      <aside class="sidepanel">
        <section class="panel"><div class="panel-title">BUILD</div><div id="build" class="build"></div></section>
        <section class="panel"><div class="panel-title">NEXT WAVE</div><div id="waveInfo" class="wave">Normal enemies</div></section>
        <section class="panel debug"><div class="panel-title">DEBUG</div><div id="debug">Loading…</div><div class="debug-buttons"><button data-debug="xp">+100 XP</button><button data-debug="boss">Boss</button><button data-debug="kill">Clear</button></div></section>
      </aside>
    </main>
  </div>
  <div id="levelup" class="overlay hidden"><div class="card-modal"><div class="modal-kicker">LEVEL UP</div><h2 id="modalTitle">Choose an upgrade</h2><div id="choices" class="choices"></div></div></div>
`;
(document.querySelector('.game-wrap') as HTMLDivElement).appendChild(canvas);

const ctx = canvas.getContext('2d')!;
let width = 900;
let height = 700;
let running = true;
let gameOver = false;
let elapsed = 0;
let playerXp = 0;
let level = 1;
let leak = 0;
let enemyId = 0;
let spawnAccumulator = 0;
let totalDamage = 0;
let boss: Enemy | null = null;
let selectedTower: Tower | null = null;
const enemies: Enemy[] = [];
const towers: Tower[] = [];
const owned = new Set<ElementType>();
const stats = new Map<ElementType, { damage: number; attacks: number }>();
const upgrades: Record<ElementType, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };

const arena = { cx: 450, cy: 350, radius: 215, pathRadius: 275 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function xpForLevel(lv: number) {
  const table = [0, 20, 45, 75, 110, 150, 195, 245, 300, 360, 425, 495, 570, 650, 735, 825, 920, 1020, 1125, 1235];
  return table[Math.min(lv - 1, table.length - 1)] ?? 1235;
}

function addXp(amount: number) {
  if (level >= 20) return;
  playerXp += amount;
  while (level < 20 && playerXp >= xpForLevel(level + 1)) {
    level += 1;
    showLevelUp();
    if (!running) break;
  }
}

function relation(attacker: ElementType, defender: ElementType | null) {
  if (!defender) return 1;
  if (counter[attacker] === defender) return 1.3;
  if (counter[defender] === attacker) return 0.7;
  return 1;
}

function relationText(attacker: ElementType) {
  return `克制 ${counter[attacker]} · 被 ${Object.keys(counter).find(key => counter[key as ElementType] === attacker) ?? '—'} 克制`;
}

function towerBase(element: ElementType) {
  const data: Record<ElementType, { damage: number; cooldown: number; range: number }> = {
    金: { damage: 24, cooldown: 0.60, range: 115 },
    木: { damage: 8, cooldown: 0.80, range: 125 },
    水: { damage: 8, cooldown: 0.70, range: 140 },
    火: { damage: 28, cooldown: 1.20, range: 120 },
    土: { damage: 55, cooldown: 1.80, range: 110 },
  };
  return data[element];
}

function addTower(element: ElementType) {
  if (owned.has(element)) {
    upgrades[element] = Math.min(3, upgrades[element] + 1);
    towers.filter(t => t.element === element).forEach(t => t.damage *= 1.15);
    return;
  }
  if (towers.length >= 4) return;
  owned.add(element);
  const angle = (towers.length / 4) * Math.PI * 2 - Math.PI / 2;
  const base = towerBase(element);
  towers.push({ element, x: arena.cx + Math.cos(angle) * arena.radius, y: arena.cy + Math.sin(angle) * arena.radius, ...base, timer: 0, color: colors[element] });
  stats.set(element, { damage: 0, attacks: 0 });
}

function spawnEnemy(kind = 'normal', forceElement: ElementType | null = null) {
  const progress = Math.min(elapsed / 270, 1);
  const hp = 35 + (200 - 35) * Math.pow(progress, 1.55);
  const data: Record<string, { hp: number; speed: number; xp: number; leak: number }> = {
    normal: { hp, speed: 30 + progress * 10, xp: 5, leak: 1 },
    fast: { hp: hp * 0.8, speed: (30 + progress * 10) * 1.6, xp: 5, leak: 1 },
    tank: { hp: hp * 3, speed: (30 + progress * 10) * 0.65, xp: 7, leak: 1 },
    split: { hp: hp * 1.5, speed: (30 + progress * 10) * 0.9, xp: 6, leak: 1 },
    healer: { hp: hp * 1.3, speed: (30 + progress * 10) * 0.9, xp: 8, leak: 1 },
    elite: { hp: hp * 5, speed: (30 + progress * 10) * 0.8, xp: 40, leak: 3 },
  };
  const d = data[kind] ?? data.normal;
  const element = forceElement ?? (Math.random() < Math.min(0.2 + elapsed / 360, 0.8) ? elements[Math.floor(Math.random() * elements.length)] : null);
  enemies.push({ id: ++enemyId, t: 0, hp: d.hp, maxHp: d.hp, speed: d.speed, element, kind, leak: d.leak, xp: d.xp, alive: true });
}

function enemyPosition(e: Enemy) {
  const a = e.t * Math.PI * 2 - Math.PI / 2;
  return { x: arena.cx + Math.cos(a) * arena.pathRadius, y: arena.cy + Math.sin(a) * arena.pathRadius };
}

function nearestTarget(tower: Tower) {
  let best: Enemy | null = null;
  let bestT = -Infinity;
  for (const e of enemies) {
    if (!e.alive || e.t >= 0.98) continue;
    const p = enemyPosition(e);
    const d = Math.hypot(p.x - tower.x, p.y - tower.y);
    if (d <= tower.range && e.t > bestT) { best = e; bestT = e.t; }
  }
  return best;
}

function damageEnemy(e: Enemy, raw: number, source: ElementType) {
  const amount = raw * relation(source, e.element);
  e.hp -= amount;
  totalDamage += amount;
  const s = stats.get(source)!;
  s.damage += amount;
  s.attacks += 1;
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e: Enemy) {
  if (!e.alive) return;
  e.alive = false;
  addXp(e.xp);
  if (e.kind === 'split') {
    for (let i = 0; i < 2; i++) spawnEnemy('normal', e.element);
  }
}

function fireTower(tower: Tower) {
  const target = nearestTarget(tower);
  if (!target) return;
  damageEnemy(target, tower.damage, tower.element);
  if (tower.element === '金') {
    const candidates = enemies.filter(e => e.alive && e !== target).sort((a, b) => b.t - a.t).slice(0, 2);
    candidates.forEach((e, i) => damageEnemy(e, tower.damage * (i === 0 ? 0.7 : 0.5), tower.element));
  }
  if (tower.element === '火') {
    const p = enemyPosition(target);
    for (const e of enemies) {
      if (!e.alive || e === target) continue;
      const q = enemyPosition(e);
      if (Math.hypot(p.x - q.x, p.y - q.y) <= 40) damageEnemy(e, 18, tower.element);
    }
  }
}

function cardPool(): Card[] {
  const cards: Card[] = [];
  for (const e of owned) {
    cards.push({ title: `${e}·锋芒`, description: `${e}塔伤害 +12%`, apply: () => towers.filter(t => t.element === e).forEach(t => t.damage *= 1.12) });
    cards.push({ title: `${e}·疾行`, description: `${e}塔攻速 +10%`, apply: () => towers.filter(t => t.element === e).forEach(t => t.cooldown *= 0.90) });
    cards.push({ title: `${e}·延展`, description: `${e}塔射程 +12%`, apply: () => towers.filter(t => t.element === e).forEach(t => t.range *= 1.12) });
  }
  cards.push({ title: '战意', description: '所有塔伤害 +8%', apply: () => towers.forEach(t => t.damage *= 1.08) });
  cards.push({ title: '急速', description: '所有塔攻速 +7%', apply: () => towers.forEach(t => t.cooldown *= 0.93) });
  cards.push({ title: '经验之心', description: '立即获得 30 XP', apply: () => addXp(30) });
  cards.push({ title: '元素共鸣', description: '所有塔射程 +8%', apply: () => towers.forEach(t => t.range *= 1.08) });
  return cards;
}

function showLevelUp() {
  running = false;
  const overlay = document.querySelector('#levelup')!;
  const choices = document.querySelector('#choices')!;
  choices.innerHTML = '';
  const pool = cardPool();
  const selected = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  document.querySelector('#modalTitle')!.textContent = level === 20 ? 'FINAL CHOICE' : `Level ${level} · Choose 1`;
  selected.forEach(card => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.innerHTML = `<strong>${card.title}</strong><span>${card.description}</span>`;
    btn.onclick = () => { card.apply(); overlay.classList.add('hidden'); running = true; refreshTowerInspector(); };
    choices.appendChild(btn);
  });
  overlay.classList.remove('hidden');
}

function spawnWave(dt: number) {
  if (elapsed > 270 || boss) return;
  spawnAccumulator += dt;
  const rate = elapsed < 60 ? 1.7 : elapsed < 120 ? 1.35 : elapsed < 180 ? 1.05 : elapsed < 240 ? 0.9 : 0.7;
  if (spawnAccumulator >= rate) {
    spawnAccumulator = 0;
    const r = Math.random();
    const kind = elapsed > 120 && r < 0.08 ? 'elite' : elapsed > 90 && r < 0.18 ? 'fast' : elapsed > 150 && r < 0.28 ? 'tank' : elapsed > 180 && r < 0.34 ? 'healer' : elapsed > 120 && r < 0.42 ? 'split' : 'normal';
    spawnEnemy(kind);
  }
}

function startBoss() {
  if (boss) return;
  const dps = Math.max(100, totalDamage / Math.max(elapsed, 1));
  const hp = dps * 25;
  boss = { id: ++enemyId, t: 0.25, hp, maxHp: hp, speed: 0, element: elements[Math.floor(Math.random() * elements.length)], kind: 'boss', leak: 20, xp: 0, alive: true };
}

function update(dt: number) {
  if (!running || gameOver) return;
  elapsed += dt;
  if (elapsed >= 270 && !boss) startBoss();
  spawnWave(dt);
  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += (e.speed * dt) / (2 * Math.PI * arena.pathRadius);
    if (e.t >= 1) { e.alive = false; leak += e.leak; if (leak >= 20) endGame(false); }
  }
  for (const tower of towers) {
    tower.timer -= dt;
    if (tower.timer <= 0) { fireTower(tower); tower.timer = tower.cooldown; }
  }
  if (boss?.alive) {
    for (const tower of towers) {
      tower.timer -= dt;
      if (tower.timer <= 0) { damageEnemy(boss, tower.damage * relation(tower.element, boss.element), tower.element); tower.timer = tower.cooldown; }
    }
    if (boss.hp <= 0) endGame(true);
  }
  updateUi();
}

function endGame(win: boolean) {
  gameOver = true;
  running = false;
  const overlay = document.querySelector('#levelup')!;
  const title = document.querySelector('#modalTitle')!;
  const choices = document.querySelector('#choices')!;
  title.textContent = win ? 'VICTORY' : 'DEFEAT';
  choices.innerHTML = `<div class="result">${win ? 'The Five Elements prevail.' : 'The circle has been breached.'}<br/><button id="restart">PLAY AGAIN</button></div>`;
  choices.querySelector<HTMLButtonElement>('#restart')!.onclick = () => location.reload();
  overlay.classList.remove('hidden');
}

function towerHitRadius(tower: Tower) {
  const r = Math.max(24, tower.range);
  return r;
}

function towerAtPoint(x: number, y: number) {
  let closest: Tower | null = null;
  let closestDistance = Infinity;
  for (const tower of towers) {
    const d = Math.hypot(x - tower.x, y - tower.y);
    if (d <= towerHitRadius(tower) && d < closestDistance) {
      closest = tower;
      closestDistance = d;
    }
  }
  return closest;
}

function formatDps(tower: Tower) {
  return tower.damage / Math.max(tower.cooldown, 0.01);
}

function refreshTowerInspector() {
  const inspector = document.querySelector<HTMLDivElement>('#towerInspector')!;
  if (!selectedTower || !towers.includes(selectedTower)) {
    inspector.classList.add('hidden');
    inspector.innerHTML = '';
    return;
  }
  const tower = selectedTower;
  const upgradeLevel = upgrades[tower.element];
  const relationValue = relation(tower.element, counter[tower.element]);
  const relationTextValue = relationText(tower.element);
  inspector.classList.remove('hidden');
  inspector.innerHTML = `
    <div class="tower-inspector-head">
      <div class="tower-inspector-icon" style="background:${tower.color}">${icons[tower.element]}</div>
      <div><strong>${tower.element}塔</strong><small>强化 ${upgradeLevel}/3</small></div>
      <button id="closeTowerInspector" aria-label="Close">×</button>
    </div>
    <div class="tower-range-label">实际攻击范围 <b>${Math.round(tower.range)}</b></div>
    <div class="tower-stat-grid">
      <div><span>伤害</span><b>${tower.damage.toFixed(1)}</b></div>
      <div><span>攻击间隔</span><b>${tower.cooldown.toFixed(2)}s</b></div>
      <div><span>攻速</span><b>${(1 / Math.max(tower.cooldown, 0.01)).toFixed(2)}/s</b></div>
      <div><span>实际DPS</span><b>${formatDps(tower).toFixed(1)}</b></div>
      <div><span>射程</span><b>${Math.round(tower.range)}</b></div>
      <div><span>属性倍率</span><b>×${relationValue.toFixed(2)}</b></div>
    </div>
    <div class="tower-effect"><span>核心效果</span><strong>${
      tower.element === '金' ? '穿透：主目标后额外攻击2个目标' :
      tower.element === '木' ? '持续：当前版本基础伤害型木塔' :
      tower.element === '水' ? '控制：当前版本基础减速型水塔' :
      tower.element === '火' ? '范围：攻击目标周围造成AOE伤害' :
      '重击：高单次伤害，后续加入眩晕'
    }</strong></div>
    <div class="tower-relation">${relationTextValue}</div>
  `;
  inspector.querySelector<HTMLButtonElement>('#closeTowerInspector')!.onclick = (event) => {
    event.stopPropagation();
    selectedTower = null;
    refreshTowerInspector();
  };
}

function selectTowerAtPointer(event: PointerEvent) {
  if (gameOver || !running) return;
  const rect = canvas.getBoundingClientRect();
  const localX = ((event.clientX - rect.left) / rect.width) * 900;
  const localY = ((event.clientY - rect.top) / rect.height) * 700;
  const tower = towerAtPoint(localX, localY);
  selectedTower = tower;
  refreshTowerInspector();
  canvas.style.cursor = tower ? 'pointer' : 'default';
}

canvas.addEventListener('pointerdown', selectTowerAtPointer);

function draw() {
  const sx = width / 900;
  const sy = height / 700;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.clearRect(0, 0, 900, 700);
  const g = ctx.createRadialGradient(450, 350, 50, 450, 350, 500);
  g.addColorStop(0, '#14253b'); g.addColorStop(1, '#070d18'); ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 700);
  ctx.strokeStyle = 'rgba(130,170,210,.12)'; ctx.lineWidth = 1;
  for (let r = 120; r <= 330; r += 35) { ctx.beginPath(); ctx.arc(450, 350, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 28; ctx.beginPath(); ctx.arc(450, 350, arena.pathRadius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(450, 350, arena.pathRadius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#0d1827'; ctx.beginPath(); ctx.arc(450, 350, arena.pathRadius - 25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.beginPath(); ctx.arc(450, 350, 82, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fb5cc'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('FIVE ELEMENTS', 450, 344); ctx.fillStyle = '#536d88'; ctx.font = '600 10px system-ui'; ctx.fillText('CIRCLE TD', 450, 362);

  if (selectedTower) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(selectedTower.x, selectedTower.y, selectedTower.range, 0, Math.PI * 2);
    ctx.fillStyle = `${selectedTower.color}16`;
    ctx.fill();
    ctx.strokeStyle = selectedTower.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(selectedTower.x, selectedTower.y, 25, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  for (const tower of towers) {
    ctx.fillStyle = tower.color; ctx.shadowColor = tower.color; ctx.shadowBlur = selectedTower === tower ? 24 : 16; ctx.beginPath(); ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#07101b'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText(icons[tower.element], tower.x, tower.y + 6);
  }
  for (const e of enemies) {
    if (!e.alive) continue;
    const p = enemyPosition(e); const c = e.element ? colors[e.element] : '#b6c1cf';
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = e.kind === 'elite' ? 14 : 6; ctx.beginPath(); ctx.arc(p.x, p.y, e.kind === 'elite' ? 13 : e.kind === 'tank' ? 11 : 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(p.x - 13, p.y - 19, 26, 3); ctx.fillStyle = '#7fe29b'; ctx.fillRect(p.x - 13, p.y - 19, 26 * Math.max(0, e.hp / e.maxHp), 3);
  }
  if (boss?.alive) {
    const p = enemyPosition(boss); ctx.fillStyle = colors[boss.element!]; ctx.shadowColor = colors[boss.element!]; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.fillText('BOSS', p.x, p.y + 4);
  }
  ctx.restore();
}

function updateUi() {
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0'); const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
  document.querySelector('#time')!.textContent = `${mm}:${ss}`;
  document.querySelector('#level')!.textContent = `Lv.${level}`;
  document.querySelector('#leak')!.textContent = `${leak} / 20`;
  document.querySelector('#build')!.innerHTML = towers.map(t => `<div class="tower-row"><i style="background:${t.color}">${icons[t.element]}</i><span>${t.element}塔</span><b>${Math.round(t.damage)}</b></div>`).join('') || '<div class="muted">Choose your first tower…</div>';
  const next = xpForLevel(Math.min(level + 1, 20));
  document.querySelector('#debug')!.innerHTML = `XP ${Math.round(playerXp)} / ${next}<br/>Enemies ${enemies.filter(e => e.alive).length}<br/>Total damage ${Math.round(totalDamage)}<br/>Boss ${boss ? `${Math.round(boss.hp)} / ${Math.round(boss.maxHp)}` : '—'}`;
  refreshTowerInspector();
}

document.querySelectorAll<HTMLButtonElement>('[data-debug]').forEach(btn => btn.onclick = () => {
  const action = btn.dataset.debug;
  if (action === 'xp') addXp(100);
  if (action === 'boss') startBoss();
  if (action === 'kill') enemies.forEach(e => e.alive = false);
});

function initialChoice() {
  running = false;
  const overlay = document.querySelector('#levelup')!;
  const choices = document.querySelector('#choices')!;
  choices.innerHTML = '';
  const selected = [...elements].sort(() => Math.random() - 0.5).slice(0, 3);
  document.querySelector('#modalTitle')!.textContent = 'Choose your first tower';
  selected.forEach(e => {
    const btn = document.createElement('button'); btn.className = 'choice element-choice'; btn.style.borderColor = colors[e]; btn.innerHTML = `<strong style="color:${colors[e]}">${icons[e]} ${e}塔</strong><span>${e === '金' ? '穿透' : e === '木' ? '持续伤害' : e === '水' ? '减速控制' : e === '火' ? '范围爆炸' : '重击眩晕'}</span>`;
    btn.onclick = () => { addTower(e); overlay.classList.add('hidden'); running = true; };
    choices.appendChild(btn);
  });
  overlay.classList.remove('hidden');
}

let last = performance.now();
function loop(now: number) { const dt = Math.min((now - last) / 1000, 0.05); last = now; update(dt); draw(); requestAnimationFrame(loop); }
initialChoice();
requestAnimationFrame(loop);
