import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, command, forecast, placementError, validateSave, dimensions, routeNext, owned } from '../src/engine.js';
import { ROUTES, ARTIFACTS, DAY_SECONDS } from '../src/data.js';
import { loadGame,saveGame,parseImport } from '../src/storage.js';

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
