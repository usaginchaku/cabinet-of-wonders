import { ARTIFACTS, BY_ID, ROUTES, FACILITIES, DECOR, AUDIENCES, PRICES, DAY_SECONDS, THEMES, CURATOR } from './data.js';

export function initialState() {
  return {
    version: 2, name: '奇妙な収集館', day: 1, coins: 1400, reputation: 10, ticket: 30,
    curator: { level: 0, experience: 0 },
    facilities: { workshop: 1, lighting: 1, room: 1 },
    collection: [
      { id: 'clock', status: 'ready', level: 1, branch: null },
      { id: 'globe', status: 'ready', level: 1, branch: null },
      { id: 'musicbox', status: 'ready', level: 1, branch: null },
      { id: 'mask', status: 'damaged', level: 1, branch: null },
    ],
    placements: [{ id: 'clock', x: 1, y: 1 }, { id: 'globe', x: 3, y: 1 }, { id: 'plant-1', kind: 'plant', x: 0, y: 2 }],
    expedition: null, session: null, history: [], nextDecor: 2,
    stats: { visitors: 0, earnings: 0, repairs: 0, upgrades: 0, placed: false },
    tutorial: 0, tutorialDismissed: false, milestones: [],
    preferences: { sound: false, motion: true, speed: 1 },
  };
}
export const dimensions = s => ({ width: s.facilities.room + 4, height: s.facilities.room + 3 });
export const entrance = s => ({ x: Math.floor(dimensions(s).width / 2), y: dimensions(s).height - 1 });
export const audience = s => AUDIENCES[(s.day - 1) % AUDIENCES.length];
export const owned = (s, id) => s.collection.find(item => item.id === id);
export const positioned = (s, id) => s.placements.find(item => item.id === id);
export const rank = s => s.reputation >= 65 ? '評判の収集館' : s.reputation >= 35 ? '街の収集館' : '小さな収集館';
const key = (x, y) => `${x},${y}`;
const hasDefinition = (catalog,id) => typeof id==='string' && Object.hasOwn(catalog,id);
const neighbors = ({x, y}) => [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}];

export function accessibleTiles(s, placements = s.placements) {
  const {width, height} = dimensions(s);
  const blocked = new Set(placements.map(p => key(p.x, p.y)));
  const start = entrance(s);
  if (blocked.has(key(start.x, start.y))) return new Set();
  const reachable = new Set([key(start.x, start.y)]), queue = [start];
  for (let i=0; i<queue.length; i++) {
    for (const n of neighbors(queue[i])) {
      const k=key(n.x,n.y);
      if (n.x<0 || n.y<0 || n.x>=width || n.y>=height || blocked.has(k) || reachable.has(k)) continue;
      reachable.add(k); queue.push(n);
    }
  }
  return reachable;
}

export function placementError(s, id, x, y) {
  const {width,height}=dimensions(s), door=entrance(s);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x<0 || y<0 || x>=width || y>=height) return '展示室の床を選んでください。';
  if (x===door.x && y===door.y) return '入口は空けておきましょう。';
  if (s.placements.some(p=>p.id!==id && p.x===x && p.y===y)) return 'ここにはすでに設備があります。';
  const next=[...s.placements.filter(p=>p.id!==id),{id,x,y}];
  const reachable=accessibleTiles(s,next);
  if (next.some(p=>!neighbors(p).some(n=>reachable.has(key(n.x,n.y))))) return '展示まで歩ける通路を残してください。';
  return null;
}

export function collections(s) {
  return Object.entries(THEMES).map(([theme,def])=>{
    const items=s.placements.filter(p=>BY_ID[p.id]?.theme===theme).map(p=>owned(s,p.id));
    const levels=items.reduce((sum,item)=>sum+item.level,0);
    return {theme,name:def.name,count:items.length,levels,complete:items.length>=3&&levels>=6};
  });
}
export const expeditionDays=(s,route)=>Math.max(1,route.days-(s.curator.level>=2?1:0));

export function forecast(s) {
  const guest=audience(s), exhibitPlacements=s.placements.filter(p=>BY_ID[p.id]);
  let appeal=0, synergy=0, capacity=0, matching=0;
  for (const p of exhibitPlacements) {
    const item=owned(s,p.id), definition=BY_ID[p.id];
    if (!item || item.status!=='ready') continue;
    const multiplier=1+(item.level-1)*.3+(item.branch==='quality'?.25:0);
    appeal+=definition.appeal*multiplier;
    capacity+=6+(item.level-1)*2+(item.branch==='access'?4:0);
    if(definition.theme===guest.theme) matching++;
    for(const other of exhibitPlacements) {
      if(p.id<other.id && BY_ID[other.id].theme===definition.theme && Math.abs(p.x-other.x)+Math.abs(p.y-other.y)===1) synergy++;
    }
  }
  const plants=s.placements.filter(p=>p.kind==='plant').length;
  const benches=s.placements.filter(p=>p.kind==='bench').length;
  const comfort=Math.min(plants,4);
  const sets=collections(s).filter(set=>set.complete).length;
  appeal=Math.round(appeal*(1+(s.facilities.lighting-1)*.12+(s.curator.level>=3?.15:0))+synergy*7+sets*12);
  capacity+=benches*3+(s.curator.level?4:0);
  const priceIndex=PRICES.indexOf(s.ticket);
  // Reputation must affect repeat custom enough to make persistent overpricing costly.
  const demand=Math.round((7+appeal/7+matching*2+comfort)*(.5+s.reputation/20)*guest.price[priceIndex]);
  const visitors=exhibitPlacements.length ? Math.min(capacity,demand) : 0;
  const satisfaction=Math.max(30,Math.min(98,76+comfort*3+synergy*2+matching*3+sets*3+(s.ticket===20?10:s.ticket===45?-20:0)-Math.max(0,demand-capacity)*2));
  const income=visitors*s.ticket;
  const wages=CURATOR.wages[s.curator.level];
  const upkeep=65+exhibitPlacements.length*8+(s.facilities.lighting-1)*15+(s.facilities.room-1)*20+wages;
  return {visitors,capacity,demand,satisfaction,income,upkeep,wages,net:income-upkeep,appeal,synergy,matching,sets,audience:guest.name,theme:guest.theme};
}

export function visitorFeedback(s) {
  const r=s.session?.report??forecast(s),feedback=[];
  if(r.demand>r.capacity)feedback.push({text:'少し混んでいるね',detail:'受入人数を増やすと、混雑による満足度低下を抑えられます。'});
  if(s.ticket===45&&r.satisfaction<85)feedback.push({text:'入館料、少し高いかな',detail:'45 Gの料金は満足度が20下がります。'});
  if(r.matching)feedback.push({text:`${THEMES[r.theme].name}の展示、好き！`,detail:'今日の客層に合う展示が集客と満足度を高めています。'});
  if(r.synergy)feedback.push({text:'この組み合わせ、いいね',detail:`同じテーマの隣接 ${r.synergy}組が魅力と満足度に加算されています。`});
  if(r.sets)feedback.push({text:'見ごたえのある特集だね',detail:`完成したテーマ展示 ${r.sets}組が魅力と満足度に加算されています。`});
  if(!feedback.length)feedback.push({text:'次はどんな品が増えるかな',detail:'調査と修復で新しい展示を増やせます。'});
  return feedback;
}

function requireThat(condition,message) { if(!condition) throw new Error(message); }
function pay(s,amount) { requireThat(s.coins>=amount,`資金が ${Math.ceil(amount-s.coins).toLocaleString('ja-JP')} G 足りません。`); s.coins-=amount; }
export const upgradeCost = item => 130*item.level + Math.round(BY_ID[item.id].appeal*2);
export const routeNext = (s,route) => route.items.find(id=>!owned(s,id));

function updateTutorial(s) {
  const repaired=owned(s,'mask')?.status==='ready';
  if(s.tutorial===0 && positioned(s,'musicbox')) s.tutorial=1;
  if(s.tutorial===1 && s.stats.visitors>0) s.tutorial=2;
  if(s.tutorial===2 && owned(s,'mask')?.status!=='damaged') s.tutorial=3;
  if(s.tutorial===3 && repaired && positioned(s,'mask')) s.tutorial=4;
  if(s.tutorial===4 && s.collection.some(item=>item.level>1)) s.tutorial=5;
}

function progressWork(s) {
  const completed=[];
  for(const item of s.collection) {
    if(item.status==='repairing') {
      item.remaining--;
      if(item.remaining<=0) { item.status='ready'; delete item.remaining; s.stats.repairs++; completed.push(`${BY_ID[item.id].name}の修復が完了`); }
    }
  }
  if(s.expedition) {
    const job=s.expedition;
    // Late departures only receive the portion of the opening day actually worked.
    job.progress+=(job.startedDay===s.day?1-job.startedElapsed/DAY_SECONDS:1);
    const days=Math.floor(job.progress+1e-9);job.remaining-=days;job.progress=Math.max(0,job.progress-days);
    if(s.expedition.remaining<=0) {
      s.collection.push({id:s.expedition.item,status:'damaged',level:1,branch:null});
      completed.push(`${BY_ID[s.expedition.item].name}を発見`);
      s.curator.experience++;
      s.expedition=null;
    }
  }
  return completed;
}

function settle(s, workshop=false) {
  const report=workshop ? {visitors:0,income:100,upkeep:0,net:100,satisfaction:0,audience:'工房の小仕事',synergy:0} : s.session.report;
  // Unpaid running costs carry into this day's cash flow, but never destroy the collection.
  const paidUpkeep=Math.min(report.upkeep,s.coins+report.income);
  const shortfall=report.upkeep-paidUpkeep;
  s.coins+=report.income-paidUpkeep;
  s.stats.visitors+=report.visitors; s.stats.earnings+=report.income;
  if(!workshop) s.reputation=Math.max(0,Math.min(100,s.reputation+(report.satisfaction>=85?3:report.satisfaction>=65?1:-2)-(shortfall?2:0)));
  const completed=progressWork(s);
  const feedback=workshop?[]:visitorFeedback(s);
  s.history.unshift({...report,feedback,net:report.income-paidUpkeep,day:s.day,shortfall,completed});
  s.history=s.history.slice(0,30); s.day++; s.session=null;
  updateTutorial(s);
  return completed;
}

/** Pure command boundary: failed commands never alter the caller's save. */
export function command(current,type,args={}) {
  const s=structuredClone(current);
  const liveActions=['tick','finish','pause','preferences','dismissTutorial','rename'];
  if(type==='expedition'&&s.curator.level>0)liveActions.push('expedition');
  if(s.session && !liveActions.includes(type)) throw new Error(type==='expedition'?'調査担当を雇うと、開館中にも出発できます。':'営業中です。閉館後に変更できます。');
  let message='';
  switch(type) {
    case 'place': {
      const item=owned(s,args.id), existing=positioned(s,args.id);
      requireThat((item?.status==='ready') || existing?.kind,'修復済みの収蔵品を選んでください。');
      const error=placementError(s,args.id,args.x,args.y); requireThat(!error,error);
      s.placements=s.placements.filter(p=>p.id!==args.id);
      s.placements.push({...(existing??{}),id:args.id,x:args.x,y:args.y});
      s.stats.placed=true; message='配置しました。'; break;
    }
    case 'store': {
      const p=positioned(s,args.id); requireThat(p,'展示されていません。');
      s.placements=s.placements.filter(p=>p.id!==args.id);
      if(p.kind){s.coins+=Math.floor(DECOR[p.kind].cost/2);message='設備を撤去して、費用の半額を回収しました。';}
      else message='収蔵庫に戻しました。';
      break;
    }
    case 'decor': {
      requireThat(hasDefinition(DECOR,args.kind),'設備が見つかりません。'); const def=DECOR[args.kind];
      const id=`${args.kind}-${s.nextDecor}`; const error=placementError(s,id,args.x,args.y); requireThat(!error,error);
      pay(s,def.cost); s.nextDecor++; s.placements.push({id,kind:args.kind,x:args.x,y:args.y}); message=`${def.name}を設置しました。`; break;
    }
    case 'repair': {
      const item=owned(s,args.id); requireThat(item?.status==='damaged','修復待ちの品を選んでください。');
      const count=s.collection.filter(i=>i.status==='repairing').length;
      requireThat(count<(s.facilities.workshop>=2?2:1),'工房の修復枠が埋まっています。');
      pay(s,BY_ID[item.id].repair); item.status='repairing'; item.remaining=Math.max(1,BY_ID[item.id].days-(s.facilities.workshop===3?1:0));
      message=`修復を始めました。あと${item.remaining}営業日。`; break;
    }
    case 'upgrade': {
      const item=owned(s,args.id); requireThat(item?.status==='ready','修復済みの品を選んでください。');
      requireThat(item.level<3,'最大まで改良済みです。');
      if(item.level===1) requireThat(['quality','access'].includes(args.branch),'改良方針を選んでください。');
      pay(s,upgradeCost(item)); if(item.level===1)item.branch=args.branch; item.level++; s.stats.upgrades++; message='展示を改良しました。'; break;
    }
    case 'facility': {
      requireThat(hasDefinition(FACILITIES,args.id),'設備が見つかりません。'); const def=FACILITIES[args.id];
      const level=s.facilities[args.id]; requireThat(level<=def.costs.length,'最大まで改良済みです。');
      pay(s,def.costs[level-1]); s.facilities[args.id]++; s.stats.upgrades++; message=`${def.name}を改良しました。`; break;
    }
    case 'expedition': {
      const route=ROUTES.find(r=>r.id===args.id); requireThat(route,'調査先が見つかりません。');
      requireThat(!s.expedition,'調査隊は出発中です。'); const item=routeNext(s,route); requireThat(item,'この場所の調査は完了しています。');
      const days=expeditionDays(s,route);
      pay(s,route.cost); s.expedition={route:route.id,item,remaining:days,total:days,progress:0,startedDay:s.day,startedElapsed:s.session?.elapsed??0}; message=`${route.name}へ出発しました。`; break;
    }
    case 'curator': {
      const level=s.curator.level;requireThat(level<3,'最大まで育成済みです。');
      requireThat(s.curator.experience>=CURATOR.experience[level],`育成には調査を${CURATOR.experience[level]}回完了してください。`);
      pay(s,CURATOR.costs[level]);s.curator.level++;message=level?'調査担当が成長しました。':'調査担当を雇いました。';break;
    }
    case 'ticket': requireThat(PRICES.includes(args.value),'入館料を選んでください。'); s.ticket=args.value; break;
    case 'open': {
      const report=forecast(s); requireThat(report.visitors>0,'収蔵品を1つ以上展示してください。');
      s.session={elapsed:0,report,paused:false}; message='開館しました。'; break;
    }
    case 'tick': {
      requireThat(s.session,'営業していません。'); requireThat(Number.isFinite(args.seconds)&&args.seconds>=0,'時間が不正です。');
      if(s.session.paused)break;
      s.session.elapsed=Math.min(DAY_SECONDS,s.session.elapsed+Math.min(args.seconds,2));
      if(s.session.elapsed>=DAY_SECONDS) { settle(s); message='本日の営業が終わりました。'; }
      break;
    }
    case 'finish': requireThat(s.session,'営業していません。'); settle(s); message='本日の営業が終わりました。'; break;
    case 'pause': requireThat(s.session,'営業していません。');s.session.paused=!s.session.paused;break;
    case 'work': settle(s,true); message='小仕事が完了。100 G を受け取りました。'; break;
    case 'dismissTutorial': s.tutorialDismissed=Boolean(args.value); break;
    case 'preferences':
      if(typeof args.motion==='boolean')s.preferences.motion=args.motion;
      if(typeof args.sound==='boolean')s.preferences.sound=args.sound;
      if(args.speed!==undefined){requireThat([1,2,4].includes(args.speed),'速度が不正です。');s.preferences.speed=args.speed;}
      break;
    case 'rename': requireThat(typeof args.name==='string'&&args.name.trim().length>0&&args.name.trim().length<=20,'館の名前は1〜20文字にしてください。'); s.name=args.name.trim(); break;
    default: throw new Error('操作が見つかりません。');
  }
  updateTutorial(s);
  return {state:s,message};
}

const finiteInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
/** Validate saves before use, including map connectivity and in-flight jobs. */
export function validateSave(value) {
  try {
    requireThat(value&&[1,2].includes(value.version),'対応していないセーブ形式です。');
    const s=structuredClone(value);
    if(s.version===1){
      s.curator={level:0,experience:Math.max(0,s.collection.length-4)};s.preferences.speed=1;
      if(s.session){s.session.elapsed=s.session.elapsed/18*DAY_SECONDS;s.session.paused=false;}
      if(s.expedition)Object.assign(s.expedition,{progress:0,startedDay:0,startedElapsed:0});
      s.version=2;
    }
    requireThat(s.curator&&finiteInt(s.curator.level,0,3)&&finiteInt(s.curator.experience,0,1000000),'調査担当の情報が不正です。');
    requireThat(typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=20,'館名が不正です。');
    for(const [field,min,max] of [['day',1,1000000],['coins',0,1e12],['reputation',0,100],['nextDecor',1,1000000],['tutorial',0,5]]) requireThat(finiteInt(s[field],min,max),`${field} が不正です。`);
    requireThat(PRICES.includes(s.ticket),'入館料が不正です。');
    requireThat(s.facilities&&Object.keys(FACILITIES).every(id=>finiteInt(s.facilities[id],1,FACILITIES[id].costs.length+1)),'設備情報が不正です。');
    requireThat(Array.isArray(s.collection)&&s.collection.length<=ARTIFACTS.length,'収蔵品の情報が不正です。');
    const ids=new Set();
    for(const item of s.collection) {
      requireThat(hasDefinition(BY_ID,item.id)&&!ids.has(item.id)&&['ready','damaged','repairing'].includes(item.status)&&finiteInt(item.level,1,3),'収蔵品が不正です。'); ids.add(item.id);
      requireThat(item.level===1?item.branch===null:['quality','access'].includes(item.branch),'改良情報が不正です。');
      if(item.status==='repairing')requireThat(finiteInt(item.remaining,1,3),'修復情報が不正です。');
    }
    requireThat(['clock','globe','musicbox','mask'].every(id=>ids.has(id)),'初期収蔵品が不足しています。');
    requireThat(s.collection.filter(item=>item.status==='repairing').length<=(s.facilities.workshop>=2?2:1),'修復枠を超えています。');
    requireThat(Array.isArray(s.placements)&&s.placements.length<=56,'配置情報が不正です。');
    const positions=new Set(), placedIds=new Set();
    const {width,height}=dimensions(s), door=entrance(s);
    for(const p of s.placements) {
      requireThat(finiteInt(p.x,0,width-1)&&finiteInt(p.y,0,height-1)&&typeof p.id==='string'&&!placedIds.has(p.id)&&!positions.has(key(p.x,p.y)),'配置が重複または範囲外です。');
      requireThat(!(p.x===door.x&&p.y===door.y),'入口が塞がれています。');
      if(p.kind) { requireThat(hasDefinition(DECOR,p.kind)&&new RegExp(`^${p.kind}-[1-9][0-9]*$`).test(p.id),'装飾が不正です。'); requireThat(Number(p.id.split('-')[1])<s.nextDecor,'設備番号が不正です。'); }
      else requireThat(owned(s,p.id)?.status==='ready','未修復の品が展示されています。');
      positions.add(key(p.x,p.y)); placedIds.add(p.id);
    }
    const reachable=accessibleTiles(s);
    requireThat(s.placements.every(p=>neighbors(p).some(n=>reachable.has(key(n.x,n.y)))),'通路が塞がれています。');
    if(s.expedition) {
      const route=ROUTES.find(r=>r.id===s.expedition.route);
      const job=s.expedition;
      requireThat(route&&!ids.has(job.item)&&route.items.includes(job.item)&&finiteInt(job.total,1,route.days)&&finiteInt(job.remaining,1,job.total)&&Number.isFinite(job.progress)&&job.progress>=0&&job.progress<1&&finiteInt(job.startedDay,0,s.day)&&Number.isFinite(job.startedElapsed)&&job.startedElapsed>=0&&job.startedElapsed<DAY_SECONDS,'調査情報が不正です。');
    }
    requireThat(s.stats&&['visitors','earnings','repairs','upgrades'].every(k=>finiteInt(s.stats[k],0,1e12))&&typeof s.stats.placed==='boolean','実績が不正です。');
    requireThat(typeof s.tutorialDismissed==='boolean'&&s.preferences&&typeof s.preferences.motion==='boolean'&&typeof s.preferences.sound==='boolean','設定が不正です。');
    requireThat([1,2,4].includes(s.preferences.speed),'速度が不正です。');
    requireThat(Array.isArray(s.history)&&s.history.length<=30,'履歴が不正です。');
    for(const report of s.history) {
      requireThat(['visitors','income','upkeep','satisfaction','day','shortfall'].every(k=>finiteInt(report[k],0,1e12))&&Number.isFinite(report.net)&&typeof report.audience==='string'&&report.audience.length<40&&Array.isArray(report.completed)&&report.completed.every(v=>typeof v==='string'&&v.length<100),'営業記録が不正です。');
      requireThat(report.feedback===undefined||Array.isArray(report.feedback)&&report.feedback.length<=5&&report.feedback.every(f=>typeof f.text==='string'&&f.text.length<80&&typeof f.detail==='string'&&f.detail.length<150),'感想の情報が不正です。');
    }
    if(s.session) {
      requireThat(Number.isFinite(s.session.elapsed)&&s.session.elapsed>=0&&s.session.elapsed<DAY_SECONDS,'営業時間が不正です。');
      requireThat(typeof s.session.paused==='boolean','一時停止の情報が不正です。');
      // Derive financial results from validated game data, never trust imported revenue.
      s.session.report=forecast(s); requireThat(s.session.report.visitors>0,'営業できる展示がありません。');
    }
    s.milestones=[];
    return {ok:true,state:s};
  } catch(error) { return {ok:false,error:error.message}; }
}
