import './style.css';

type ElementType = '金' | '木' | '水' | '火' | '土';
type Rarity = '普通' | '稀有' | '史诗' | '传说' | '神话';
type EnemyKind = 'normal' | 'fast' | 'tank' | 'split' | 'healer' | 'elite' | 'boss';

type Tower = {
  id: number; element: ElementType; x: number; y: number; baseDamage: number; baseCooldown: number; baseRange: number;
  damageMul: number; cooldownMul: number; rangeMul: number; statusMul: number; timer: number; level: number;
};

type Enemy = {
  id: number; t: number; hp: number; maxHp: number; speed: number; element: ElementType | null; kind: EnemyKind;
  leak: number; xp: number; alive: boolean; slow: number; slowTime: number; stunTime: number;
  poisonDps: number; poisonTime: number; burnDps: number; burnTime: number;
};

type Card = { title: string; rarity: Rarity; element: ElementType; description: string; apply: (tower: Tower) => void };

const elements: ElementType[] = ['金', '木', '水', '火', '土'];
const colors: Record<ElementType, string> = { 金: '#f5c542', 木: '#59c878', 水: '#54b9ff', 火: '#ff7043', 土: '#c79a62' };
const icons: Record<ElementType, string> = { 金: '✦', 木: '✣', 水: '◈', 火: '◆', 土: '⬟' };
const counter: Record<ElementType, ElementType> = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
const rarities: Rarity[] = ['普通', '稀有', '史诗', '传说', '神话'];
const rarityMul: Record<Rarity, number> = { 普通: 1, 稀有: 1.12, 史诗: 1.26, 传说: 1.45, 神话: 1.72 };
const rarityColor: Record<Rarity, string> = { 普通: '#8ea1b4', 稀有: '#59b8ff', 史诗: '#bd79ff', 传说: '#ffb84d', 神话: '#ff5c7a' };

const root = document.querySelector<HTMLDivElement>('#root')!;
root.innerHTML = `
<div class="shell">
<header class="topbar"><div class="brand"><span class="brand-mark">五</span><div><strong>FIVE ELEMENTS</strong><small>CIRCLE TD · WEB TEST V1</small></div></div><div class="stats"><div><span>TIME</span><b id="time">00:00</b></div><div><span>LEVEL</span><b id="level">Lv.1</b></div><div><span>XP</span><b id="xp">0</b></div><div class="leak"><span>LEAK</span><b id="leak">0 / 20</b></div></div></header>
<main class="stage"><div class="game-wrap"><canvas id="game"></canvas><div id="towerInspector" class="tower-inspector hidden"></div><div id="toast" class="toast hidden"></div></div>
<aside class="sidepanel"><section class="panel"><div class="panel-title">BUILD</div><div id="build" class="build"></div></section><section class="panel"><div class="panel-title">RUN</div><div id="runInfo" class="wave"></div></section><section class="panel debug"><div class="panel-title">DEBUG</div><div id="debug">Loading…</div><div class="debug-buttons"><button data-debug="xp">+100 XP</button><button data-debug="boss">Boss</button><button data-debug="kill">Clear</button></div></section></aside></main></div>
<div id="levelup" class="overlay hidden"><div class="card-modal"><div class="modal-kicker" id="modalKicker">LEVEL UP</div><h2 id="modalTitle">Choose 1</h2><div id="choices" class="choices"></div></div></div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
let width = 900, height = 700;
let running = false, gameOver = false, elapsed = 0, xp = 0, level = 1, leak = 0;
let enemyId = 0, towerId = 0, spawnTimer = 0, totalDamage = 0, pendingLevelUps = 0;
let boss: Enemy | null = null, selectedTower: Tower | null = null;
const enemies: Enemy[] = [], towers: Tower[] = [];
const acquired = new Set<ElementType>();
const cardHistory: Card[] = [];
const stats = new Map<ElementType, { damage: number; hits: number }>();
const arena = { cx: 450, cy: 350, towerRadius: 210, pathRadius: 275 };

function resize() { const r = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); width = r.width; height = r.height; canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
window.addEventListener('resize', resize); resize();

function xpNeed(lv: number) { const table = [0, 22, 50, 85, 125, 175, 235, 305, 385, 475, 575, 685, 805, 935, 1075, 1225, 1385, 1555, 1735, 1925]; return table[Math.min(lv - 1, table.length - 1)] ?? 1925; }
function relation(a: ElementType, d: ElementType | null) { if (!d) return 1; if (counter[a] === d) return 1.3; if (counter[d] === a) return 0.7; return 1; }
function relationLabel(e: ElementType) { const beatenBy = elements.find(x => counter[x] === e)!; return `克制 ${counter[e]} ×1.30 · 被 ${beatenBy} 克制 ×0.70`; }
function towerBase(e: ElementType) { return ({ 金:{damage:25,cooldown:.62,range:125}, 木:{damage:11,cooldown:.78,range:130}, 水:{damage:10,cooldown:.72,range:145}, 火:{damage:24,cooldown:1.12,range:122}, 土:{damage:52,cooldown:1.75,range:112} } as Record<ElementType,{damage:number;cooldown:number;range:number}>)[e]; }
function towerName(e: ElementType) { return ({金:'穿透',木:'毒蚀',水:'寒流',火:'爆炎',土:'重击'} as Record<ElementType,string>)[e]; }
function towerEffect(e: ElementType) { return ({金:'主目标后额外穿透2个目标，伤害递减。',木:'命中叠加毒素，持续造成伤害，最多5层。',水:'命中施加减速，降低移动速度并延长控制。',火:'命中目标产生范围爆炸，并附加燃烧。',土:'高单次伤害，命中有概率造成短暂眩晕。'} as Record<ElementType,string>)[e]; }
function towerStats(t: Tower) { return { damage:t.baseDamage*t.damageMul, cooldown:t.baseCooldown*t.cooldownMul, range:t.baseRange*t.rangeMul, dps:t.baseDamage*t.damageMul/(t.baseCooldown*t.cooldownMul) }; }

function addTower(e: ElementType) {
  if (towers.length >= 5) return false;
  const b = towerBase(e), angle = (towers.length / 5) * Math.PI * 2 - Math.PI / 2;
  const t: Tower = { id:++towerId, element:e, x:arena.cx+Math.cos(angle)*arena.towerRadius, y:arena.cy+Math.sin(angle)*arena.towerRadius, baseDamage:b.damage, baseCooldown:b.cooldown, baseRange:b.range, damageMul:1, cooldownMul:1, rangeMul:1, statusMul:1, timer:.05, level:1 };
  towers.push(t); acquired.add(e); stats.set(e,{damage:0,hits:0}); return true;
}
function towersOf(e: ElementType) { return towers.filter(t=>t.element===e); }

function spawnEnemy(kind: EnemyKind='normal', forceElement: ElementType|null=null) {
  const p=Math.min(elapsed/270,1), base=42+260*Math.pow(p,1.65);
  const d: Record<EnemyKind,{hp:number;speed:number;xp:number;leak:number}>={
    normal:{hp:base,speed:31+p*11,xp:5,leak:1}, fast:{hp:base*.68,speed:(31+p*11)*1.7,xp:6,leak:1}, tank:{hp:base*3.1,speed:(31+p*11)*.62,xp:9,leak:1},
    split:{hp:base*1.55,speed:(31+p*11)*.9,xp:8,leak:1}, healer:{hp:base*1.4,speed:(31+p*11)*.82,xp:10,leak:1}, elite:{hp:base*5.4,speed:(31+p*11)*.76,xp:45,leak:3}, boss:{hp:1,speed:16,xp:0,leak:20}
  }[kind];
  const el=forceElement ?? (Math.random()<Math.min(.22+elapsed/360,.82)?elements[Math.floor(Math.random()*5)]:null);
  enemies.push({id:++enemyId,t:0,hp:d.hp,maxHp:d.hp,speed:d.speed,element:el,kind,leak:d.leak,xp:d.xp,alive:true,slow:1,slowTime:0,stunTime:0,poisonDps:0,poisonTime:0,burnDps:0,burnTime:0});
}
function enemyPos(e: Enemy) { const a=e.t*Math.PI*2-Math.PI/2; return {x:arena.cx+Math.cos(a)*arena.pathRadius,y:arena.cy+Math.sin(a)*arena.pathRadius}; }
function inRange(t: Tower, e: Enemy) { const p=enemyPos(e), s=towerStats(t); return Math.hypot(p.x-t.x,p.y-t.y)<=s.range; }
function targetFor(t: Tower) { let best:Enemy|null=null,bestT=-1; for(const e of enemies) if(e.alive&&e.t<.995&&inRange(t,e)&&e.t>bestT){best=e;bestT=e.t;} return best; }

function kill(e: Enemy) { if(!e.alive)return; e.alive=false; xp+=e.xp; if(e.kind==='split'){spawnEnemy('normal',e.element);spawnEnemy('normal',e.element);} checkLevel(); }
function checkLevel(){ while(level<20&&xp>=xpNeed(level+1)){level++;pendingLevelUps++;} if(pendingLevelUps>0&&!document.querySelector('#levelup')!.classList.contains('hidden')) return; if(pendingLevelUps>0) showNextChoice(); }
function addXp(v:number){xp+=v;checkLevel();}

function applyStatus(e:Enemy,t:Tower,raw:number){ const mul=relation(t.element,e.element); if(t.element==='木'){e.poisonDps=Math.min(e.poisonDps+raw*.20*t.statusMul,raw*1.25);e.poisonTime=3.2;} if(t.element==='水'){e.slow=.62;e.slowTime=Math.max(e.slowTime,1.8*t.statusMul);} if(t.element==='火'){e.burnDps=Math.max(e.burnDps,raw*.18*t.statusMul);e.burnTime=3.0;} if(t.element==='土'&&Math.random()<Math.min(.34*t.statusMul,.8)){e.stunTime=Math.max(e.stunTime,.7*t.statusMul);} return mul; }
function hit(e:Enemy,t:Tower,raw:number){ if(!e.alive)return; const amount=raw*relation(t.element,e.element); e.hp-=amount; totalDamage+=amount; stats.get(t.element)!.damage+=amount; stats.get(t.element)!.hits++; applyStatus(e,t,raw); if(e.hp<=0)kill(e); }
function fire(t:Tower){ const target=targetFor(t); if(!target)return; const s=towerStats(t); hit(target,t,s.damage);
  if(t.element==='金'){ const chain=enemies.filter(e=>e.alive&&e!==target&&inRange(t,e)).sort((a,b)=>b.t-a.t).slice(0,2); chain.forEach((e,i)=>hit(e,t,s.damage*(i===0?.65:.42))); }
  if(t.element==='火'){ const p=enemyPos(target); for(const e of enemies){if(!e.alive||e===target)continue;const q=enemyPos(e);if(Math.hypot(p.x-q.x,p.y-q.y)<=48)hit(e,t,s.damage*.48);} }
}

function updateEnemy(e:Enemy,dt:number){ if(!e.alive)return; if(e.poisonTime>0){e.hp-=e.poisonDps*dt;e.poisonTime-=dt;if(e.hp<=0){kill(e);return;}} if(e.burnTime>0){e.hp-=e.burnDps*dt;e.burnTime-=dt;if(e.hp<=0){kill(e);return;}} if(e.kind==='healer'&&Math.floor(elapsed*2)%5===0){for(const o of enemies){if(o!==e&&o.alive&&Math.hypot(enemyPos(o).x-enemyPos(e).x,enemyPos(o).y-enemyPos(e).y)<70)o.hp=Math.min(o.maxHp,o.hp+o.maxHp*.012*dt);}}
  if(e.stunTime>0){e.stunTime-=dt;return;} if(e.slowTime>0)e.slowTime-=dt;else e.slow=1; e.t+=(e.speed*e.slow*dt)/(2*Math.PI*arena.pathRadius); if(e.t>=1){e.alive=false;leak+=e.leak;if(leak>=20)endGame(false);} }

function spawnWave(dt:number){ if(elapsed>=270||boss)return; spawnTimer+=dt; const interval=elapsed<60?1.55:elapsed<120?1.18:elapsed<180?.9:elapsed<240?.72:.58; if(spawnTimer<interval)return;spawnTimer=0;const r=Math.random();let k:EnemyKind='normal';if(elapsed>95&&r<.13)k='fast';else if(elapsed>125&&r<.25)k='tank';else if(elapsed>145&&r<.34)k='split';else if(elapsed>170&&r<.42)k='healer';else if(elapsed>115&&r<.49)k='elite';spawnEnemy(k);}
function startBoss(){if(boss)return;const dps=Math.max(90,totalDamage/Math.max(elapsed,1));const hp=dps*30+900;boss={id:++enemyId,t:.15,hp,maxHp:hp,speed:11,element:elements[Math.floor(Math.random()*5)],kind:'boss',leak:20,xp:0,alive:true,slow:1,slowTime:0,stunTime:0,poisonDps:0,poisonTime:0,burnDps:0,burnTime:0};enemies.push(boss);toast(`BOSS · ${boss.element}属性`);}

function cardPool():Card[]{ const pool:Card[]=[]; const effects:[string,string,(t:Tower)=>void][]=[
  ['锋刃','伤害 +12%',t=>t.damageMul*=1.12],['疾行','攻速 +10%',t=>t.cooldownMul*=.90],['远见','射程 +12%',t=>t.rangeMul*=1.12],['专精','核心效果强度 +15%',t=>t.statusMul*=1.15],
  ['破军','伤害 +20%，射程 -5%',t=>{t.damageMul*=1.20;t.rangeMul*=.95}],['鹰眼','射程 +20%，伤害 -4%',t=>{t.rangeMul*=1.20;t.damageMul*=.96}],['连弩','攻速 +18%，伤害 -8%',t=>{t.cooldownMul*=.82;t.damageMul*=.92}],['坚壁','伤害 +9%，范围效果 +20%',t=>{t.damageMul*=1.09;t.statusMul*=1.20}],
  ['元素共鸣','对克制属性额外 +10%',t=>t.damageMul*=1.10],['穿透强化','金塔额外穿透伤害 +18%',t=>t.damageMul*=1.18],['毒池','木塔毒素 +30%',t=>t.statusMul*=1.30],['寒域','水塔减速 +22%',t=>t.statusMul*=1.22],['炎核','火塔爆炸 +25%',t=>t.statusMul*=1.25],['震荡','土塔眩晕 +25%',t=>t.statusMul*=1.25],
  ['贪狼','伤害 +15%，每次击杀后下次攻击 +25%',t=>t.damageMul*=1.15],['天命','全属性小幅提升 +8%',t=>{t.damageMul*=1.08;t.cooldownMul*=.92;t.rangeMul*=1.08}]
 ];
  for(const e of acquired) for(let i=0;i<16;i++){const r=rarities[Math.min(4,Math.floor(i/4))];const ef=effects[i];pool.push({title:`${e}·${ef[0]}`,rarity:r,element:e,description:`${ef[1]} · ${towerName(e)}体系`,apply:ef[2]});}
  return pool;
}
function drawChoices(){ const pool=cardPool(); const choices:Card[]=[]; const seen=new Set<string>(); while(choices.length<3&&pool.length){const c=pool[Math.floor(Math.random()*pool.length)];if(!seen.has(c.title)){seen.add(c.title);choices.push(c);}} return choices; }
function showNextChoice(){ if(pendingLevelUps<=0)return; running=false; const overlay=document.querySelector('#levelup')!;const choicesEl=document.querySelector('#choices')!;choicesEl.innerHTML='';document.querySelector('#modalKicker')!.textContent=`LEVEL ${level}`;document.querySelector('#modalTitle')!.textContent='三选一 · 塔强化'; const choices=drawChoices(); choices.forEach(c=>{const b=document.createElement('button');b.className='choice';b.style.borderColor=rarityColor[c.rarity];b.innerHTML=`<small style="color:${rarityColor[c.rarity]}">${c.rarity} · ${c.element}塔</small><strong>${c.title}</strong><span>${c.description}</span>`;b.onclick=()=>{const t=towers.find(x=>x.element===c.element);if(t){c.apply(t);t.level++;cardHistory.push(c);toast(`${c.rarity} · ${c.title}`);} pendingLevelUps--;overlay.classList.add('hidden');if(pendingLevelUps>0)showNextChoice();else running=true;refreshInspector();};choicesEl.appendChild(b);});overlay.classList.remove('hidden');}
function initialChoice(){running=false;const overlay=document.querySelector('#levelup')!;const choices=document.querySelector('#choices')!;choices.innerHTML='';document.querySelector('#modalKicker')!.textContent='START';document.querySelector('#modalTitle')!.textContent='选择第一座塔';elements.sort(()=>Math.random()-.5).slice(0,3).forEach(e=>{const b=document.createElement('button');b.className='choice element-choice';b.style.borderColor=colors[e];b.innerHTML=`<small style="color:${colors[e]}">元素塔</small><strong>${icons[e]} ${e} · ${towerName(e)}</strong><span>${towerEffect(e)}<br>${relationLabel(e)}</span>`;b.onclick=()=>{addTower(e);overlay.classList.add('hidden');running=true;refreshInspector();};choices.appendChild(b);});overlay.classList.remove('hidden');}

function towerAt(x:number,y:number){let hitTower:Tower|null=null,d=Infinity;for(const t of towers){const dd=Math.hypot(x-t.x,y-t.y);if(dd<28&&dd<d){hitTower=t;d=dd;}}return hitTower;}
function refreshInspector(){const el=document.querySelector<HTMLDivElement>('#towerInspector')!;if(!selectedTower||!towers.includes(selectedTower)){el.classList.add('hidden');el.innerHTML='';return;}const t=selectedTower,s=towerStats(t);el.classList.remove('hidden');el.innerHTML=`<div class="tower-inspector-head"><div class="tower-inspector-icon" style="background:${colors[t.element]}">${icons[t.element]}</div><div><strong>${t.element}塔 · ${towerName(t.element)}</strong><small>塔等级 ${t.level} · 强化 ${cardHistory.filter(c=>c.element===t.element).length} 次</small></div><button id="closeTower">×</button></div><div class="tower-range-label">实际攻击范围 <b>${s.range.toFixed(0)}</b></div><div class="tower-stat-grid"><div><span>伤害</span><b>${s.damage.toFixed(1)}</b></div><div><span>攻击间隔</span><b>${s.cooldown.toFixed(2)}s</b></div><div><span>攻速</span><b>${(1/s.cooldown).toFixed(2)}/s</b></div><div><span>实际DPS</span><b>${s.dps.toFixed(1)}</b></div><div><span>状态强度</span><b>${(t.statusMul*100).toFixed(0)}%</b></div><div><span>元素倍率</span><b>×1.00–1.30</b></div></div><div class="tower-effect"><span>核心效果</span><strong>${towerEffect(t.element)}</strong></div><div class="tower-relation">${relationLabel(t.element)}</div>`;el.querySelector('#closeTower')!.addEventListener('click',e=>{e.stopPropagation();selectedTower=null;refreshInspector();});}
canvas.addEventListener('pointerdown',e=>{if(!running||gameOver)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*900,y=(e.clientY-r.top)/r.height*700;selectedTower=towerAt(x,y);refreshInspector();});

function update(dt:number){if(!running||gameOver)return;elapsed+=dt;if(elapsed>=270&&!boss)startBoss();spawnWave(dt);for(const e of enemies)updateEnemy(e,dt);for(const t of towers){t.timer-=dt;if(t.timer<=0){fire(t);t.timer+=towerStats(t).cooldown;}}if(boss?.alive&&boss.hp<=0)endGame(true);updateUi();}
function endGame(win:boolean){gameOver=true;running=false;const overlay=document.querySelector('#levelup')!;document.querySelector('#modalKicker')!.textContent='RUN COMPLETE';document.querySelector('#modalTitle')!.textContent=win?'VICTORY':'DEFEAT';document.querySelector('#choices')!.innerHTML=`<div class="result">${win?'Boss defeated. Build complete.':'20 leaks reached.'}<br>等级 Lv.${level} · 总伤害 ${Math.round(totalDamage)}<br><button id="restart">PLAY AGAIN</button></div>`;document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>location.reload();overlay.classList.remove('hidden');}
function toast(msg:string){const t=document.querySelector<HTMLDivElement>('#toast')!;t.textContent=msg;t.classList.remove('hidden');clearTimeout(Number(t.dataset.timer));const id=window.setTimeout(()=>t.classList.add('hidden'),1800);t.dataset.timer=String(id);}
function updateUi(){const m=String(Math.floor(elapsed/60)).padStart(2,'0'),s=String(Math.floor(elapsed%60)).padStart(2,'0');document.querySelector('#time')!.textContent=`${m}:${s}`;document.querySelector('#level')!.textContent=`Lv.${level}`;document.querySelector('#xp')!.textContent=`${Math.round(xp)} / ${xpNeed(Math.min(level+1,20))}`;document.querySelector('#leak')!.textContent=`${leak} / 20`;document.querySelector('#build')!.innerHTML=towers.map(t=>{const s=towerStats(t);return `<div class="tower-row"><i style="background:${colors[t.element]}">${icons[t.element]}</i><span>${t.element} ${towerName(t.element)}<small> Lv.${t.level}</small></span><b>${s.dps.toFixed(0)}</b></div>`}).join('');document.querySelector('#runInfo')!.innerHTML=`${boss?'BOSS':'Survival'} · ${boss?boss.element+'属性':''}<br>塔 ${towers.length}/5 · 卡牌 ${cardHistory.length}/19<br>元素：${[...acquired].join(' · ')}`;document.querySelector('#debug')!.innerHTML=`活怪 ${enemies.filter(e=>e.alive).length}<br>总伤害 ${Math.round(totalDamage)}<br>Boss ${boss?`${Math.max(0,Math.round(boss.hp))}/${Math.round(boss.maxHp)}`:'—'}`;refreshInspector();}

document.querySelectorAll<HTMLButtonElement>('[data-debug]').forEach(b=>b.onclick=()=>{const a=b.dataset.debug;if(a==='xp')addXp(100);if(a==='boss')startBoss();if(a==='kill')enemies.forEach(e=>e.alive=false);});

function draw(){const sx=width/900,sy=height/700;ctx.save();ctx.scale(sx,sy);ctx.clearRect(0,0,900,700);const bg=ctx.createRadialGradient(450,350,40,450,350,520);bg.addColorStop(0,'#172b42');bg.addColorStop(1,'#050b14');ctx.fillStyle=bg;ctx.fillRect(0,0,900,700);
  ctx.strokeStyle='rgba(130,170,210,.10)';ctx.lineWidth=1;for(let r=110;r<=330;r+=35){ctx.beginPath();ctx.arc(450,350,r,0,Math.PI*2);ctx.stroke();}
  ctx.strokeStyle='rgba(220,235,250,.15)';ctx.lineWidth=30;ctx.beginPath();ctx.arc(450,350,arena.pathRadius,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=22;ctx.beginPath();ctx.arc(450,350,arena.pathRadius,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#0b1625';ctx.beginPath();ctx.arc(450,350,240,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.arc(450,350,80,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a6bbcf';ctx.textAlign='center';ctx.font='800 13px system-ui';ctx.fillText('FIVE ELEMENTS',450,345);ctx.fillStyle='#506981';ctx.font='600 10px system-ui';ctx.fillText('BUILD · ADAPT · SURVIVE',450,363);
  if(selectedTower){const s=towerStats(selectedTower);ctx.beginPath();ctx.arc(selectedTower.x,selectedTower.y,s.range,0,Math.PI*2);ctx.fillStyle=`${colors[selectedTower.element]}16`;ctx.fill();ctx.strokeStyle=colors[selectedTower.element];ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(selectedTower.x,selectedTower.y,27,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
  for(const t of towers){const c=colors[t.element];ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=selectedTower===t?25:14;ctx.beginPath();ctx.arc(t.x,t.y,21,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#08111d';ctx.font='900 17px system-ui';ctx.textAlign='center';ctx.fillText(icons[t.element],t.x,t.y+6);}
  for(const e of enemies){if(!e.alive)continue;const p=enemyPos(e),c=e.element?colors[e.element]:'#b8c4d1',r=e.kind==='boss'?29:e.kind==='elite'?14:e.kind==='tank'?11:8;ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=e.kind==='boss'?28:8;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(p.x-15,p.y-r-8,30,4);ctx.fillStyle='#7fe29b';ctx.fillRect(p.x-15,p.y-r-8,30*Math.max(0,e.hp/e.maxHp),4);if(e.stunTime>0){ctx.strokeStyle='#f5c542';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,Math.PI*2);ctx.stroke();}}
  if(boss?.alive){ctx.fillStyle='#fff';ctx.font='900 12px system-ui';ctx.fillText(`${boss.element} BOSS`,450,44);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(250,54,400,8);ctx.fillStyle=colors[boss.element];ctx.fillRect(250,54,400*Math.max(0,boss.hp/boss.maxHp),8);}
  ctx.restore();}

let last=performance.now();function loop(now:number){const dt=Math.min((now-last)/1000,.05);last=now;update(dt);draw();requestAnimationFrame(loop);}initialChoice();requestAnimationFrame(loop);
