import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, command, forecast, investmentPreview, expeditionCost, upgradeCost, validateSave } from '../src/engine.js';
import { ROUTES, THEME_GRANT } from '../src/data.js';

const act=(s,t,a)=>command(s,t,a).state;
const day=s=>act(act(s,'open'),'finish');
// A layout reached during the fresh-save playthrough: five exhibits, narrow entrance-side aisles.
function smallGallery(){
  const s=initialState();s.coins=10000;s.reputation=18;s.curator={level:2,experience:5};
  s.collection=s.collection.map(i=>({...i,status:'ready',...(['clock','musicbox'].includes(i.id)?{level:2,branch:'quality'}:{})}));
  s.collection.push({id:'train',status:'ready',level:2,branch:'access'});
  s.placements.push({id:'musicbox',x:2,y:1},{id:'mask',x:4,y:0},{id:'train',x:3,y:2});
  return s;
}

test('quality and throughput trade places depending on the current bottleneck',()=>{
  const narrow=smallGallery(),n=forecast(narrow);
  assert(n.floorCapacity<n.serviceCapacity);
  const quality=investmentPreview(narrow,'upgrade',{id:'mask',branch:'quality'});
  const access=investmentPreview(narrow,'upgrade',{id:'mask',branch:'access'});
  assert.equal(quality.capacity,0);assert.equal(access.capacity,0);assert(quality.profit>access.profit);
  const spacious=act(narrow,'facility',{id:'room'});spacious.reputation=25;
  assert(investmentPreview(spacious,'upgrade',{id:'mask',branch:'access'}).profit>investmentPreview(spacious,'upgrade',{id:'mask',branch:'quality'}).profit);
});

test('expansion helps a crowded floor, while premature expansion still has a maintenance tradeoff',()=>{
  const fresh=investmentPreview(initialState(),'facility',{id:'room'});
  assert.equal(fresh.capacity,0);assert.equal(fresh.profit,-20);
  const crowded=investmentPreview(smallGallery(),'facility',{id:'room'});
  assert(crowded.capacity>0);assert(crowded.profit>0);
});

test('lighting earns donations at capacity, and every curator level adds service capacity',()=>{
  let s=smallGallery();const before=forecast(s),lit=forecast(act(s,'facility',{id:'lighting'}));
  assert.equal(lit.visitors,before.visitors);assert(lit.donations>before.donations);assert(lit.operatingNet>before.operatingNet);
  s=act(s,'facility',{id:'room'});s.curator.level=0;
  for(let i=1;i<=3;i++){const previous=forecast(s);s=act(s,'curator');assert.equal(forecast(s).serviceCapacity,previous.serviceCapacity+4);}
});

test('research prices grow with route progress; insufficient funds cannot begin a job',()=>{
  const route=ROUTES[0];let s=initialState();assert.equal(expeditionCost(s,route),220);
  s=day(act(s,'expedition',{id:route.id}));assert.equal(expeditionCost(s,route),330);
  const poor={...s,coins:329},copy=structuredClone(poor);assert.throws(()=>act(poor,'expedition',{id:route.id}),/足りません/);assert.deepEqual(poor,copy);
  const next=act(s,'expedition',{id:route.id});assert.equal(s.coins-next.coins,330);
});

test('early improvements remain accessible while the final upgrade competes with other investments',()=>{
  let s=initialState();assert.equal(upgradeCost(s.collection[0]),166);
  s=act(s,'upgrade',{id:'clock',branch:'quality'});assert.equal(upgradeCost(s.collection[0]),866);
  const poor={...s,coins:865};assert.throws(()=>act(poor,'upgrade',{id:'clock'}),/足りません/);assert.equal(poor.collection[0].level,2);
});

test('first exhibition support is separated from recurring profit and cannot repeat after reload or redisplay',()=>{
  let s=smallGallery();const preview=forecast(s);assert.equal(preview.grant,THEME_GRANT);assert.equal(preview.net,preview.operatingNet+THEME_GRANT);
  const opening=act(s,'open'),loaded=validateSave(JSON.parse(JSON.stringify(opening)));assert(loaded.ok);
  const before=s.coins;s=act(loaded.state,'finish');assert.equal(s.coins,before+preview.net);assert.deepEqual(s.milestones,['mechanism']);
  assert.equal(forecast(s).grant,0);assert.equal(s.history[0].grant,THEME_GRANT);
  s=act(s,'store',{id:'train'});s=act(s,'place',{id:'train',x:3,y:2});s=validateSave(s).state;assert.equal(forecast(s).grant,0);
  assert.equal(day(s).history[0].grant,0);
  const worked=act(smallGallery(),'work');assert.deepEqual(worked.milestones,[]);assert.equal(worked.history[0].income,100);
});

test('investment preview is pure, works before funds are available, and matches the actual purchase',()=>{
  const s=smallGallery(),before=structuredClone(s),shown=investmentPreview({...s,coins:0},'facility',{id:'room'});
  const next=act(s,'facility',{id:'room'});
  assert.equal(shown.profit,forecast(next).operatingNet-forecast(s).operatingNet);assert.deepEqual(s,before);
  assert.equal(investmentPreview(act(s,'open'),'facility',{id:'room'}),null);
  const pending=structuredClone(s);pending.collection.find(i=>i.id==='train').level=1;pending.collection.find(i=>i.id==='train').branch=null;
  assert.equal(investmentPreview(pending,'upgrade',{id:'train',branch:'quality'}).grant,THEME_GRANT);
});

test('older saves retain their collection, history and active day; malformed new records are rejected',()=>{
  let old=day(initialState());delete old.milestones;
  for(const key of ['admissions','donations','grant','newThemes','serviceCapacity','floorCapacity','operatingNet'])delete old.history[0][key];
  const before=structuredClone(old),read=validateSave(old);assert(read.ok);assert.deepEqual(old,before);assert.deepEqual(read.state.collection,old.collection);assert.deepEqual(read.state.history,old.history);
  const active=act(read.state,'open');delete active.milestones;active.session.report.income=1e12;
  const checked=validateSave(active);assert(checked.ok);assert.equal(checked.state.session.report.income,forecast(checked.state).income);
  for(const milestones of [['mechanism','mechanism'],['__proto__'],'mechanism'])assert.equal(validateSave({...initialState(),milestones}).ok,false);
  old.history[0].donations=-1;assert.equal(validateSave(old).ok,false);
});


test('crowding reduces satisfaction but cannot erase more than 24 points of collection quality',()=>{
  const s=smallGallery();s.reputation=100;
  const crowded=forecast(s),withoutCrowding=76+3+crowded.synergy*2+crowded.matching*3+crowded.sets*3;
  assert(crowded.demand>crowded.capacity+12);assert.equal(crowded.satisfaction,withoutCrowding-24);
});

test('investment previews expose satisfaction and show training benefits before experience is earned',()=>{
  let s=initialState();s.curator={level:1,experience:0};const copy=structuredClone(s);
  assert(investmentPreview(s,'curator'));assert.deepEqual(s,copy);assert.throws(()=>act(s,'curator'),/調査を/);
  s=smallGallery();const preview=investmentPreview(s,'facility',{id:'room'}),after=forecast(act(s,'facility',{id:'room'}));
  assert.equal(preview.satisfaction,after.satisfaction);assert.equal(preview.satisfactionChange,after.satisfaction-forecast(s).satisfaction);
});
