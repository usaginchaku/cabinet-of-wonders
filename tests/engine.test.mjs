import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, command, forecast, placementError, validateSave, dimensions, routeNext, owned, collections, visitorFeedback } from '../src/engine.js';
import { ROUTES, ARTIFACTS, DAY_SECONDS } from '../src/data.js';
import { loadGame,saveGame,parseImport,migrationBackup } from '../src/storage.js';

const act=(s,type,args)=>command(s,type,args).state;
const day=s=>act(act(s,'open'),'finish');
test('a fresh game is valid, profitable, and has no paid online dependency',()=>{
 const s=initialState();assert.equal(validateSave(s).ok,true);assert(forecast(s).net>0);assert.equal(s.collection.length,4);
});
test('display -> income -> repair -> display -> upgrade completes onboarding',()=>{
 let s=initialState();s=act(s,'place',{id:'musicbox',x:2,y:1});assert.equal(s.tutorial,1);
 const coins=s.coins,expected=forecast(s).net;s=day(s);assert.equal(s.coins,coins+expected);assert.equal(s.tutorial,2);
 s=act(s,'repair',{id:'mask'});assert.equal(s.tutorial,3);s=day(s);assert.equal(owned(s,'mask').status,'ready');
 s=act(s,'place',{id:'mask',x:4,y:0});assert.equal(s.tutorial,4);
 s=act(s,'upgrade',{id:'mask',branch:'quality'});assert.equal(s.tutorial,5);assert.equal(validateSave(s).ok,true);
});
test('funds, job capacity, busy operations and repeated clicks are transactional',()=>{
 const s=initialState();const poor={...s,coins:0};assert.throws(()=>command(poor,'repair',{id:'mask'}),/足りません/);assert.equal(owned(poor,'mask').status,'damaged');
 let busy=act(s,'repair',{id:'mask'});assert.throws(()=>command(busy,'repair',{id:'mask'}),/修復待ち/);
 busy.collection.push({id:'train',status:'damaged',level:1,branch:null});assert.throws(()=>command(busy,'repair',{id:'train'}),/埋まっています/);
 const open=act(s,'open');assert.throws(()=>command(open,'ticket',{value:45}),/営業中/);assert.throws(()=>command(open,'open'),/営業中/);
 const closed=act(open,'finish');assert.throws(()=>command(closed,'finish'),/営業していません/);assert.equal(closed.day,2);
});
test('tutorial requires the named exhibit and an exhibit upgrade, not a facility upgrade',()=>{
 let s=initialState();s=act(s,'place',{id:'clock',x:0,y:0});assert.equal(s.tutorial,0);
 s=act(s,'place',{id:'musicbox',x:2,y:1});s=day(s);s=act(s,'facility',{id:'lighting'});
 s=act(s,'repair',{id:'mask'});s=day(s);s=act(s,'place',{id:'mask',x:4,y:0});assert.equal(s.tutorial,4);
 s=act(s,'upgrade',{id:'clock',branch:'access'});assert.equal(s.tutorial,5);
});
test('entrance, overlap, bounds and inaccessible exhibits are rejected',()=>{
 const s=initialState();assert.match(placementError(s,'musicbox',2,3),/入口/);assert.match(placementError(s,'musicbox',1,1),/すでに/);assert.match(placementError(s,'musicbox',-1,0),/床/);
 s.placements=[{id:'clock',x:1,y:1},{id:'globe',x:0,y:1},{id:'plant-1',kind:'plant',x:1,y:0},{id:'musicbox',x:2,y:1}];
 assert.match(placementError(s,'mask',1,2),/通路/);
});
test('theme adjacency and upgrade branches change actual economic inputs',()=>{
 const s=initialState();const together=act(s,'place',{id:'musicbox',x:2,y:1});const apart=act(s,'place',{id:'musicbox',x:4,y:0});
 assert.equal(forecast(together).synergy,1);assert(forecast(together).appeal>forecast(apart).appeal);
 const quality=act(together,'upgrade',{id:'clock',branch:'quality'});const access=act(together,'upgrade',{id:'clock',branch:'access'});
 assert(forecast(quality).appeal>forecast(access).appeal);assert(forecast(access).capacity>forecast(quality).capacity);
 const pricey=act(s,'ticket',{value:45});assert(forecast(pricey).satisfaction<forecast(s).satisfaction);
});
test('decor can be removed with a partial refund so layout mistakes never lock out exhibits',()=>{
 let s=initialState();const before=s.coins,collection=structuredClone(s.collection);
 s=act(s,'decor',{kind:'bench',x:0,y:0});const id=s.placements.find(p=>p.kind==='bench').id;
 s=act(s,'store',{id});assert(!s.placements.some(p=>p.id===id));assert.equal(s.coins,before-90);assert.deepEqual(s.collection,collection);
});
test('short-term high pricing has a meaningful 30-day reputation and earnings cost',()=>{
 const simulate=price=>{let s=initialState();for(let i=0;i<30;i++)s=day(act(s,'ticket',{value:price}));return s;};
 const standard=simulate(30),expensive=simulate(45);
 assert(standard.coins>expensive.coins);assert(standard.reputation>expensive.reputation);
});
test('research returns the named item once and repair time reduces with the workshop',()=>{
 let s=initialState();s=act(s,'expedition',{id:'market'});assert.equal(s.expedition.item,'train');assert.throws(()=>command(s,'expedition',{id:'port'}),/出発中/);
 s=day(s);assert.equal(s.expedition,null);assert.equal(owned(s,'train').status,'damaged');s=day(s);assert.equal(s.collection.filter(i=>i.id==='train').length,1);
 s.coins=10000;s=act(s,'facility',{id:'workshop'});s=act(s,'facility',{id:'workshop'});s=act(s,'repair',{id:'train'});assert.equal(owned(s,'train').remaining,1);
});
test('all 15 pieces, expansions and a sustainable later museum are attainable',()=>{
 let s=initialState();s=act(s,'place',{id:'musicbox',x:2,y:1});s=day(s);
 for(const route of ROUTES){
   while(routeNext(s,route)){
     while(s.coins<route.cost+600)s=day(s);
     s=act(s,'expedition',{id:route.id});while(s.expedition)s=day(s);
     const damaged=s.collection.filter(i=>i.status==='damaged');
     for(const item of damaged){while(s.coins<600)s=day(s);s=act(s,'repair',{id:item.id});while(owned(s,item.id).status==='repairing')s=day(s);}
   }
 }
 assert.equal(s.collection.length,ARTIFACTS.length);
 while(s.coins<5000)s=day(s);s=act(s,'facility',{id:'room'});s=act(s,'facility',{id:'room'});assert.deepEqual(dimensions(s),{width:7,height:6});
 assert.equal(validateSave(s).ok,true);assert(forecast(s).net>0);assert(s.day<100);
});
test('closing time settles once and resumed sessions do not duplicate earnings',()=>{
 let s=act(initialState(),'open');s.session.elapsed=DAY_SECONDS-.1;
 s=act(s,'tick',{seconds:.2});assert.equal(s.session,null);assert.equal(s.history.length,1);
 assert.throws(()=>command(s,'tick',{seconds:1}),/営業していません/);
 const running=act(s,'open');running.session.elapsed=6;
 const read=validateSave(JSON.parse(JSON.stringify(running)));assert(read.ok);assert.equal(read.state.session.elapsed,6);
});
test('bad saves reject corruption, duplicate IDs, invalid jobs, blocked paths and forged income',()=>{
 assert.equal(parseImport('{broken').ok,false);assert.equal(validateSave({...initialState(),coins:NaN}).ok,false);
 let s=initialState();s.collection.push({...s.collection[0]});assert.equal(validateSave(s).ok,false);
 s=initialState();s.placements.push({id:'mask',x:2,y:3});assert.equal(validateSave(s).ok,false);
 s=initialState();s.expedition={route:'market',item:'mask',remaining:1,total:1};assert.equal(validateSave(s).ok,false);
 s=initialState();s.collection.push({id:'toString',status:'ready',level:1,branch:null});assert.equal(validateSave(s).ok,false);
 s=initialState();s.placements.push({id:'constructor-2',kind:'constructor',x:0,y:0});s.nextDecor=3;assert.equal(validateSave(s).ok,false);
 s=act(initialState(),'open');s.session.report.income=999999999;const checked=validateSave(s);assert(checked.ok);assert.notEqual(checked.state.session.report.income,999999999);
});
test('storage read errors preserve data and zero-cash recovery advances repairs',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 let s=initialState();saveGame(s,storage);s=day(s);saveGame(s,storage);assert.equal(loadGame(storage).state.day,2);assert.equal(values.size,2);
 const bad={getItem:()=>'{bad',setItem:()=>assert.fail('must not overwrite')};assert(loadGame(bad).error);
 s=initialState();s.coins=0;s=act(s,'work');assert.equal(s.coins,100);assert.equal(s.day,2);assert.equal(validateSave(s).ok,true);
});

test('v1 saves migrate in-flight days and expeditions without mutating the original',()=>{
 let old=act(initialState(),'expedition',{id:'port'});old=act(old,'open');
 old.version=1;delete old.curator;delete old.preferences.speed;delete old.session.paused;
 old.session.elapsed=9;for(const field of ['progress','startedDay','startedElapsed'])delete old.expedition[field];
 const snapshot=structuredClone(old),loaded=validateSave(old);assert(loaded.ok);assert.deepEqual(old,snapshot);
 const s=loaded.state;assert.equal(s.version,2);assert.equal(s.session.elapsed,30);assert.equal(s.coins,old.coins);
 const values=new Map([['curio-museum.save.v1',JSON.stringify(old)]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 saveGame(s,storage);saveGame(act(s,'finish'),storage);assert.equal(migrationBackup(storage),JSON.stringify(old));
 const failStorage={getItem:storage.getItem,setItem:()=>{throw new Error('QuotaExceededError');}};
 assert.throws(()=>saveGame(s,failStorage),/QuotaExceeded/);
 assert.deepEqual(s.collection,old.collection);assert.deepEqual(s.placements,old.placements);
 assert.equal(s.expedition.remaining,2);assert.equal(s.preferences.speed,1);assert.equal(s.curator.level,0);
 const next=act(s,'finish');assert.equal(next.expedition.remaining,1);assert(validateSave(next).ok);
 old.session.elapsed=19;assert.equal(validateSave(old).ok,false);
});

test('a curator permits live research, charges wages, and counts only remaining time',()=>{
 let s=initialState();s.coins=10000;
 assert.throws(()=>command(act(s,'open'),'expedition',{id:'market'}),/調査担当/);
 const original=forecast(s);s=act(s,'curator');assert.equal(forecast(s).upkeep,original.upkeep+60);assert.equal(forecast(s).capacity,original.capacity+4);
 s=act(s,'open');s.session.elapsed=30;s=act(s,'expedition',{id:'market'});
 const saved=validateSave(s);assert(saved.ok);s=act(saved.state,'finish');
 assert.equal(s.expedition.remaining,1);assert.equal(s.expedition.progress,.5);assert.equal(s.curator.experience,0);
 s=day(s);assert.equal(s.expedition,null);assert.equal(s.curator.experience,1);assert.equal(owned(s,'train').status,'damaged');
 assert.throws(()=>command(s,'curator'),/2回/);
 s=act(s,'expedition',{id:'market'});s=day(s);s=act(s,'curator');assert.equal(s.curator.level,2);
 s=act(s,'expedition',{id:'port'});assert.equal(s.expedition.total,1);s=day(s);
 s=act(s,'expedition',{id:'estate'});s=day(s);s=act(s,'expedition',{id:'estate'});s=day(s);
 const previousAppeal=forecast(s).appeal;s=act(s,'curator');assert.equal(s.curator.level,3);
 assert(forecast(s).appeal>previousAppeal);assert.equal(forecast(s).wages,140);assert(validateSave(s).ok);
 assert.throws(()=>command(s,'curator'),/最大/);
});

test('late research never gains a full day immediately, and roundoff remains saveable',()=>{
 let s=initialState();s.coins=10000;s=act(s,'curator');s=act(s,'open');s.session.elapsed=59.99;
 s=act(s,'expedition',{id:'market'});s=act(s,'finish');assert(s.expedition.progress<.001);assert(!owned(s,'train'));
 assert(validateSave(s).ok);
 s=act(s,'open');s.expedition.remaining=2;s.expedition.total=2;s.expedition.route='port';s.expedition.item='tarot';
 s.expedition.progress=.9999999999;s=act(s,'finish');assert.equal(s.expedition,null);
});

test('pause and speed are persisted and invalid controls are transactional',()=>{
 let s=act(initialState(),'open');s=act(s,'pause');s=act(s,'tick',{seconds:2});assert.equal(s.session.elapsed,0);
 s=act(s,'preferences',{speed:4});assert.equal(validateSave(s).state.preferences.speed,4);
 s=act(s,'pause');s=act(s,'tick',{seconds:2});assert.equal(s.session.elapsed,2);
 assert.throws(()=>command(s,'preferences',{speed:100}),/速度/);assert.equal(s.preferences.speed,4);
 const invalid=structuredClone(s);invalid.session.paused='yes';assert.equal(validateSave(invalid).ok,false);
 invalid.session.paused=false;invalid.curator.level=4;assert.equal(validateSave(invalid).ok,false);
});

test('research completed before hiring counts toward training, including completed v1 collections',()=>{
 let s=initialState();s=act(s,'expedition',{id:'market'});s=day(s);assert.equal(s.curator.experience,1);
 s.coins=10000;s=act(s,'curator');assert.equal(s.curator.experience,1);
 const old=initialState();old.version=1;delete old.curator;delete old.preferences.speed;
 for(const def of ARTIFACTS)if(!owned(old,def.id))old.collection.push({id:def.id,status:'ready',level:1,branch:null});
 const loaded=validateSave(old);assert(loaded.ok);s=loaded.state;assert.equal(s.curator.experience,11);s.coins=10000;
 for(let i=0;i<3;i++)s=act(s,'curator');assert.equal(s.curator.level,3);assert(validateSave(s).ok);
});

test('theme sets reward displayed upgraded collections and maximum expansion stays valid',()=>{
 let s=initialState();s.coins=10000;s.collection.push({id:'train',status:'ready',level:1,branch:null});
 for(const id of ['room','room','room'])s=act(s,'facility',{id});assert.deepEqual(dimensions(s),{width:8,height:7});
 assert.throws(()=>command(s,'facility',{id:'room'}),/最大/);
 s=act(s,'place',{id:'musicbox',x:2,y:1});s=act(s,'place',{id:'train',x:2,y:2});
 for(const id of ['clock','musicbox','train'])s=act(s,'upgrade',{id,branch:'access'});
 assert.equal(collections(s).find(g=>g.theme==='mechanism').complete,true);assert.equal(forecast(s).sets,1);
 assert(visitorFeedback(s).some(f=>f.text.includes('特集')));assert(validateSave(s).ok);
 s=act(s,'store',{id:'train'});assert.equal(forecast(s).sets,0);
 s=act(s,'ticket',{value:45});assert(visitorFeedback(s).some(f=>f.text.includes('高い')));
 s=day(s);assert(s.history[0].feedback.length);assert(validateSave(s).ok);
});
