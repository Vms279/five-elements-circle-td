import './style.css';

type E='金'|'木'|'水'|'火'|'土';
type TowerCard={cardId:number;element:E;quantity:number};
type Tower={towerId:number;element:E;x:number;y:number;damage:number;cooldown:number;range:number;level:number;timer:number};
type Enemy={id:number,d:number,hp:number,maxHp:number,speed:number,alive:boolean};

const ELS:E[]=['金','木','水','火','土'];
const COLOR:Record<E,string>={金:'#f5c542',木:'#59c878',水:'#54b9ff',火:'#ff7043',土:'#c79a62'};
const ICON:Record<E,string>={金:'✦',木:'✣',水:'◈',火:'◆',土:'⬟'};
const NAME:Record<E,string>={金:'穿透',木:'毒蚀',水:'寒流',火:'爆炎',土:'重击'};
const EFFECT:Record<E,string>={金:'主目标后额外穿透目标。',木:'命中造成持续毒伤。',水:'命中减速敌人。',火:'命中产生范围爆炸。',土:'高单次伤害并有机会眩晕。'};
const BASE:Record<E,{damage:number;cooldown:number;range:number}>={金:{damage:25,cooldown:.62,range:125},木:{damage:11,cooldown:.78,range:130},水:{damage:10,cooldown:.72,range:145},火:{damage:24,cooldown:1.12,range:122},土:{damage:52,cooldown:1.75,range:112}};

const root=document.querySelector<HTMLDivElement>('#root')!;
root.innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><span class="brand-mark">五</span><div><strong>FIVE ELEMENTS</strong><small>MAZE TD · PLAYTEST</small></div></div><div class="stats"><div><span>TIME</span><b id="time">00:00</b></div><div><span>LEVEL</span><b id="level">Lv.1</b></div><div><span>XP</span><b id="xp">0</b></div><div class="leak"><span>LEAK</span><b id="leak">0 / 20</b></div></div></header><main class="stage"><div class="game-wrap"><canvas id="game"></canvas><div id="towerInspector" class="tower-inspector hidden"></div><div id="dragGhost" class="drag-ghost hidden"></div><div id="toast" class="toast hidden"></div></div><aside class="sidepanel"><section class="panel"><div class="panel-title">TOWER CARDS · 塔卡仓库</div><div id="build" class="build"></div></section><section class="panel"><div class="panel-title">RUN</div><div id="runInfo" class="wave"></div></section><section class="panel debug"><div class="panel-title">PLAYTEST</div><div id="debug">Loading…</div><div class="debug-buttons"><button id="debugXp">+100 XP</button><button id="debugCards">+4 Cards</button><button id="debugClear">Clear</button></div></section></aside></main></div><div id="levelup" class="overlay hidden"><div class="card-modal"><div class="modal-kicker" id="modalKicker">LEVEL UP</div><h2 id="modalTitle">Choose</h2><div id="choices" class="choices"></div></div></div>`;

const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const ctx=canvas.getContext('2d')!;
const build=document.querySelector<HTMLDivElement>('#build')!;
const inspector=document.querySelector<HTMLDivElement>('#towerInspector')!;
const ghost=document.querySelector<HTMLDivElement>('#dragGhost')!;

let W=900,H=700,time=0,xp=0,level=1,leak=0,ended=false,running=false;
let nextCardId=0,nextTowerId=0,nextEnemyId=0,spawnTimer=0;
let selectedTowerId:number|null=null;
let draggingCardId:number|null=null;
let draggingTowerId:number|null=null;
let dragX=0,dragY=0,dragValid=false,dragMoved=false;
let pendingLevelChoices=0;

const cards:TowerCard[]=[];
const towers:Tower[]=[];
const enemies:Enemy[]=[];

const path=[{x:45,y:55},{x:180,y:55},{x:180,y:145},{x:345,y:145},{x:345,y:65},{x:575,y:65},{x:575,y:180},{x:790,y:180},{x:790,y:305},{x:635,y:305},{x:635,y:420},{x:825,y:420},{x:825,y:555},{x:600,y:555},{x:600,y:630},{x:370,y:630},{x:370,y:520},{x:145,y:520},{x:145,y:400},{x:305,y:400},{x:305,y:285},{x:90,y:285},{x:90,y:205},{x:45,y:205},{x:45,y:55}];
const ROAD=54;let totalPath=0;const lens=[0];for(let i=1;i<path.length;i++){totalPath+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);lens.push(totalPath)}

function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);W=r.width;H=r.height;canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0)}
addEventListener('resize',resize);resize();
function pathPos(dist:number){let i=1;while(i<lens.length&&lens[i]<dist)i++;const a=path[i-1],b=path[i],s=lens[i]-lens[i-1],q=s?(dist-lens[i-1])/s:0;return{x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q}}
function segmentDistance(px:number,py:number,a:{x:number,y:number},b:{x:number,y:number}){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(px-a.x,py-a.y);const q=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/l));return Math.hypot(px-(a.x+q*dx),py-(a.y+q*dy))}
function roadDistance(x:number,y:number){let d=Infinity;for(let i=1;i<path.length;i++)d=Math.min(d,segmentDistance(x,y,path[i-1],path[i]));return d}
function canPlace(x:number,y:number,ignoreId:number|null=null){if(x<35||x>865||y<35||y>665)return false;if(roadDistance(x,y)<ROAD/2+25)return false;return !towers.some(t=>t.towerId!==ignoreId&&Math.hypot(t.x-x,t.y-y)<52)}
function toast(text:string){const el=document.querySelector<HTMLDivElement>('#toast')!;el.textContent=text;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),1600)}
function cardFor(id:number){return cards.find(c=>c.cardId===id)}
function cardForElement(e:E){return cards.find(c=>c.element===e)}
function addCard(e:E,quantity=1){const c=cardForElement(e);if(c)c.quantity+=quantity;else cards.push({cardId:++nextCardId,element:e,quantity});renderCards()}
function consumeCard(id:number){const c=cardFor(id);if(!c)return false;c.quantity--;if(c.quantity<=0){const i=cards.indexOf(c);cards.splice(i,1)}renderCards();return true}
function createTowerFromCard(cardId:number,x:number,y:number){const c=cardFor(cardId);if(!c||c.quantity<=0||!canPlace(x,y))return false;const b=BASE[c.element];consumeCard(cardId);towers.push({towerId:++nextTowerId,element:c.element,x,y,damage:b.damage,cooldown:b.cooldown,range:b.range,level:1,timer:.1});draggingCardId=null;ghost.classList.add('hidden');toast(`${c.element}塔已放置`);return true}

function renderCards(){
  const existing=new Map<number,HTMLElement>();
  build.querySelectorAll<HTMLElement>('[data-card-id]').forEach(el=>existing.set(Number(el.dataset.cardId),el));
  for(const c of cards){
    let el=existing.get(c.cardId) as HTMLButtonElement|undefined;
    if(!el){
      el=document.createElement('button');el.className='tower-row tower-card';el.dataset.cardId=String(c.cardId);el.type='button';el.innerHTML=`<i></i><span></span><b></b>`;build.appendChild(el)
    }
    el.style.opacity=c.quantity>0?'1':'.4';
    const icon=el.querySelector('i')! as HTMLElement;icon.style.background=COLOR[c.element];icon.textContent=ICON[c.element];
    const span=el.querySelector('span')!;span.innerHTML=`${c.element} · ${NAME[c.element]}<small>拖出到地图部署<br>${EFFECT[c.element]}</small>`;
    const count=el.querySelector('b')!;count.textContent=`×${c.quantity}`;
    existing.delete(c.cardId)
  }
  for(const el of existing.values())el.remove();
  if(!cards.length)build.innerHTML='<div class="muted">仓库为空。获得塔卡后会自动存放在这里。</div>';
}

function beginCardDrag(id:number){const c=cardFor(id);if(!c||c.quantity<=0)return;draggingCardId=id;draggingTowerId=null;dragMoved=false;ghost.textContent=`${ICON[c.element]} ${c.element}塔`;ghost.style.background=COLOR[c.element];ghost.classList.remove('hidden');}
function updateGhost(clientX:number,clientY:number){const r=canvas.getBoundingClientRect();dragX=(clientX-r.left)/r.width*900;dragY=(clientY-r.top)/r.height*700;dragValid=draggingCardId!==null?canPlace(dragX,dragY):canPlace(dragX,dragY,draggingTowerId);ghost.style.left=`${clientX+12}px`;ghost.style.top=`${clientY+12}px`;ghost.style.borderColor=dragValid?'#70e29a':'#ff6666';}

build.addEventListener('pointerdown',ev=>{const el=(ev.target as HTMLElement).closest<HTMLElement>('[data-card-id]');if(!el)return;ev.preventDefault();beginCardDrag(Number(el.dataset.cardId));(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)});
build.addEventListener('pointermove',ev=>{if(draggingCardId===null)return;updateGhost(ev.clientX,ev.clientY)});
build.addEventListener('pointerup',ev=>{if(draggingCardId===null)return;const cardId=draggingCardId;const r=canvas.getBoundingClientRect();const inside=ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom;if(inside){updateGhost(ev.clientX,ev.clientY);if(createTowerFromCard(cardId,dragX,dragY))ui();else toast('这里不能放塔');}draggingCardId=null;ghost.classList.add('hidden');});
build.addEventListener('pointercancel',()=>{draggingCardId=null;ghost.classList.add('hidden')});

function towerAt(x:number,y:number){let hit:Tower|null=null,best=Infinity;for(const t of towers){const d=Math.hypot(t.x-x,t.y-y);if(d<30&&d<best){hit=t;best=d}}return hit}
function towerStats(t:Tower){return{damage:t.damage,cooldown:t.cooldown,range:t.range,dps:t.damage/t.cooldown}}
function showInspector(t:Tower|null){selectedTowerId=t?.towerId??null;if(!t){inspector.classList.add('hidden');return}const s=towerStats(t);inspector.classList.remove('hidden');inspector.innerHTML=`<div class="tower-inspector-head"><div class="tower-inspector-icon" style="background:${COLOR[t.element]}">${ICON[t.element]}</div><div><strong>${t.element}塔 · ${NAME[t.element]}</strong><small>塔 ID #${t.towerId} · 等级 ${t.level}</small></div><button id="closeTower" type="button">×</button></div><div class="tower-range-label">实际攻击范围 <b>${s.range.toFixed(0)}</b></div><div class="tower-stat-grid"><div><span>伤害</span><b>${s.damage.toFixed(1)}</b></div><div><span>攻击间隔</span><b>${s.cooldown.toFixed(2)}s</b></div><div><span>实际 DPS</span><b>${s.dps.toFixed(1)}</b></div></div><div class="tower-effect"><span>核心效果</span><strong>${EFFECT[t.element]}</strong></div>`;inspector.querySelector<HTMLButtonElement>('#closeTower')!.onclick=()=>showInspector(null)}

function pointerPoint(ev:PointerEvent){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*900,y:(ev.clientY-r.top)/r.height*700}}
canvas.addEventListener('pointerdown',ev=>{const {x,y}=pointerPoint(ev);const t=towerAt(x,y);if(!t){showInspector(null);return}draggingTowerId=t.towerId;dragX=x;dragY=y;dragMoved=false;dragValid=true;canvas.setPointerCapture(ev.pointerId);showInspector(t);});
canvas.addEventListener('pointermove',ev=>{if(draggingTowerId===null)return;const {x,y}=pointerPoint(ev);if(Math.hypot(x-dragX,y-dragY)>4)dragMoved=true;dragX=x;dragY=y;dragValid=canPlace(x,y,draggingTowerId);});
canvas.addEventListener('pointerup',ev=>{if(draggingTowerId===null)return;const id=draggingTowerId;draggingTowerId=null;if(dragMoved){const t=towers.find(v=>v.towerId===id);if(t&&dragValid){t.x=dragX;t.y=dragY;toast(`${t.element}塔已移动`)}else if(t)toast('位置无效，塔保持原位')}});canvas.addEventListener('pointercancel',()=>{draggingTowerId=null});

function showLevelChoices(){running=false;const ov=document.querySelector<HTMLDivElement>('#levelup')!;const ch=document.querySelector<HTMLDivElement>('#choices')!;ch.innerHTML='';document.querySelector('#modalKicker')!.textContent=`LEVEL ${level}`;document.querySelector('#modalTitle')!.textContent='选择一张塔卡';const options=ELS.sort(()=>Math.random()-.5).slice(0,3);for(const e of options){const b=document.createElement('button');b.className='choice element-choice';b.style.borderColor=COLOR[e];b.innerHTML=`<small style="color:${COLOR[e]}">塔卡</small><strong>${ICON[e]} ${e} · ${NAME[e]}</strong><span>${EFFECT[e]}<br>获得后自动进入塔卡仓库</span>`;b.onclick=()=>{addCard(e,1);pendingLevelChoices--;ov.classList.add('hidden');if(pendingLevelChoices)showLevelChoices();else running=true;ui()};ch.appendChild(b)}ov.classList.remove('hidden')}
function firstChoice(){running=false;const ov=document.querySelector<HTMLDivElement>('#levelup')!;const ch=document.querySelector<HTMLDivElement>('#choices')!;ch.innerHTML='';document.querySelector('#modalKicker')!.textContent='START';document.querySelector('#modalTitle')!.textContent='选择第一张塔卡';for(const e of ELS.sort(()=>Math.random()-.5).slice(0,3)){const b=document.createElement('button');b.className='choice element-choice';b.style.borderColor=COLOR[e];b.innerHTML=`<small style="color:${COLOR[e]}">塔卡</small><strong>${ICON[e]} ${e} · ${NAME[e]}</strong><span>${EFFECT[e]}<br>获得后存入塔卡仓库</span>`;b.onclick=()=>{addCard(e,1);ov.classList.add('hidden');running=true;toast(`已获得 ${e}塔卡，可从仓库拖出部署`);ui()};ch.appendChild(b)}ov.classList.remove('hidden')}

function gainXp(n:number){xp+=n;const need=30+level*level*12;if(xp>=need){xp-=need;level++;pendingLevelChoices=1;showLevelChoices()}}
function spawnEnemy(){enemies.push({id:++nextEnemyId,d:0,hp:50+level*25,maxHp:50+level*25,speed:30+level*1.5,alive:true})}
function update(dt:number){if(!running||ended)return;time+=dt;spawnTimer+=dt;if(spawnTimer>1.2){spawnTimer=0;spawnEnemy()}for(const e of enemies){if(!e.alive)continue;e.d+=e.speed*dt;if(e.d>=totalPath){e.alive=false;leak++;if(leak>=20)end(false)}}for(const t of towers){t.timer-=dt;if(t.timer<=0){const target=enemies.find(e=>e.alive&&Math.hypot(pathPos(e.d).x-t.x,pathPos(e.d).y-t.y)<=t.range);if(target){target.hp-=t.damage;if(target.hp<=0){target.alive=false;gainXp(5)}}t.timer=t.cooldown}}ui()}
function end(win:boolean){ended=true;running=false;const ov=document.querySelector<HTMLDivElement>('#levelup')!;document.querySelector('#modalKicker')!.textContent='RUN COMPLETE';document.querySelector('#modalTitle')!.textContent=win?'VICTORY':'DEFEAT';document.querySelector('#choices')!.innerHTML=`<div class="result">${win?'Run complete.':'20 leaks reached.'}<br><button id="restart">PLAY AGAIN</button></div>`;document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>location.reload();ov.classList.remove('hidden')}
function ui(){const m=String(Math.floor(time/60)).padStart(2,'0'),s=String(Math.floor(time%60)).padStart(2,'0');document.querySelector('#time')!.textContent=`${m}:${s}`;document.querySelector('#level')!.textContent=`Lv.${level}`;document.querySelector('#xp')!.textContent=`${xp}`;document.querySelector('#leak')!.textContent=`${leak} / 20`;document.querySelector('#runInfo')!.innerHTML=`${running?'MAZE SURVIVAL':'选择/部署暂停'}<br>战场塔 ${towers.length} · 仓库种类 ${cards.length}<br>拖动塔卡到地图即可部署`;document.querySelector('#debug')!.innerHTML=`敌人 ${enemies.filter(e=>e.alive).length}<br>塔卡 ${cards.map(c=>`${c.element}×${c.quantity}`).join(' ')||'—'}<br>塔实体 ${towers.length}`;renderCards();if(selectedTowerId!==null)showInspector(towers.find(t=>t.towerId===selectedTowerId)??null)}

function draw(){const sx=W/900,sy=H/700;ctx.save();ctx.scale(sx,sy);ctx.clearRect(0,0,900,700);ctx.fillStyle='#08111d';ctx.fillRect(0,0,900,700);ctx.strokeStyle='#172936';ctx.lineWidth=ROAD+12;ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);path.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.strokeStyle='#566b58';ctx.lineWidth=ROAD;ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);path.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();for(const t of towers){const c=COLOR[t.element];if(selectedTowerId===t.towerId&&!draggingTowerId){ctx.beginPath();ctx.arc(t.x,t.y,t.range,0,Math.PI*2);ctx.fillStyle=`${c}18`;ctx.fill();ctx.strokeStyle=c;ctx.setLineDash([8,6]);ctx.stroke();ctx.setLineDash([])}ctx.fillStyle=c;ctx.beginPath();ctx.arc(t.x,t.y,21,0,Math.PI*2);ctx.fill();ctx.fillStyle='#08111d';ctx.font='900 17px system-ui';ctx.textAlign='center';ctx.fillText(ICON[t.element],t.x,t.y+6)}for(const e of enemies){if(!e.alive)continue;const p=pathPos(e.d);ctx.fillStyle='#b8c4d1';ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fill()}if(draggingTowerId!==null){ctx.beginPath();ctx.arc(dragX,dragY,towers.find(t=>t.towerId===draggingTowerId)?.range??120,0,Math.PI*2);ctx.fillStyle=dragValid?'rgba(80,220,140,.15)':'rgba(255,80,80,.15)';ctx.fill();ctx.strokeStyle=dragValid?'#70e29a':'#ff6666';ctx.stroke()}ctx.restore()}
let last=performance.now();function loop(now:number){const dt=Math.min((now-last)/1000,.05);last=now;update(dt);draw();requestAnimationFrame(loop)}

document.querySelector('#debugXp')!.addEventListener('click',()=>{gainXp(100);ui()});
document.querySelector('#debugCards')!.addEventListener('click',()=>{ELS.slice(0,4).forEach(e=>addCard(e));ui()});
document.querySelector('#debugClear')!.addEventListener('click',()=>enemies.forEach(e=>e.alive=false));

firstChoice();ui();requestAnimationFrame(loop);
