import './style.css';

type E='金'|'木'|'水'|'火'|'土';
type K='normal'|'fast'|'tank'|'split'|'healer'|'elite'|'boss';
type Tower={id:number,e:E,x:number,y:number,damage:number,cooldown:number,range:number,dm:number,cm:number,rm:number,sm:number,timer:number,level:number};
type Enemy={id:number,d:number,hp:number,maxHp:number,speed:number,e:E|null,k:K,leak:number,xp:number,alive:boolean,slow:number,slowTime:number,stun:number,poison:number,poisonTime:number,burn:number,burnTime:number};
