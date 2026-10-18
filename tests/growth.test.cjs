const {chromium,webkit,devices}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const base=process.env.MUSEUM_TEST_URL||'http://127.0.0.1:4173',key='curio-museum.save.v1',results=[],errors=[];
const a=(p,n,id)=>p.locator(`button[data-action="${n}"]${id?`[data-id="${id}"]`:''}`);
const read=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
async function closeDay(p){await a(p,'open').click();await p.waitForTimeout(650);await a(p,'finish').click();await p.locator('[data-modal-action="confirm"]').click();}
(async()=>{
 const engine=await import(pathToFileURL(path.resolve('src/engine.js')));
 const b=await chromium.launch({headless:true,executablePath:process.env.MUSEUM_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const p=await b.newPage({viewport:{width:1440,height:960}});p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  await check('investment forecast matches purchase and opening summary separates donations',async()=>{
   const before=await read(p),change=engine.investmentPreview(before,'facility',{id:'lighting'});
   const row=p.locator('.facility-row').filter({has:a(p,'facility','lighting')});assert((await row.innerText()).includes(`利益 +${change.profit} G / 日`));
   await a(p,'facility','lighting').click();const bought=await read(p);assert.equal(bought.coins,before.coins-420);
   assert.equal(engine.forecast(bought).operatingNet-engine.forecast(before).operatingNet,change.profit);
   await closeDay(p);const r=(await read(p)).history[0];assert(r.donations>0);assert.equal(r.income,r.admissions+r.donations+r.grant);
   const lines=await p.locator('.summary-line').allTextContents();assert(lines.some(s=>s.includes('展示への寄付')));assert(lines.some(s=>s.includes(`入館料の売上${r.admissions.toLocaleString('ja-JP')} G`)));
  });
  let s=engine.initialState();s.coins=5000;s.curator={level:2,experience:5};s.facilities.room=2;
  s.collection=s.collection.map(i=>({...i,status:'ready',level:i.id==='globe'?1:2,branch:i.id==='globe'?null:'quality'}));s.collection.push({id:'train',status:'ready',level:2,branch:'access'});
  s.placements.push({id:'musicbox',x:1,y:2},{id:'mask',x:4,y:0},{id:'train',x:3,y:2});
  s.collection.push({id:'ruby',status:'ready',level:1,branch:null});s.placements.push({id:'ruby',x:4,y:2});
  const c=await b.newContext();await c.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},{key,s});const q=await c.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(base);
  await check('a foreground exhibit does not intercept the visible portion of an exhibit behind it',async()=>{
   await q.locator('[data-object="globe"]').click({timeout:3000});assert.equal(await a(q,'move').getAttribute('data-id'),'globe');
   await a(q,'tab','museum').click();
  });
  await check('first exhibition reward is visible, settles once, and remains claimed after reload',async()=>{
   assert.match(await q.locator('.grant-note').innerText(),/500 G/);await closeDay(q);
   assert.equal((await read(q)).history[0].grant,500);assert.match(await q.locator('.modal-body').innerText(),/初公開の支援金/);
   await q.reload();assert.equal(await q.locator('.grant-note').count(),0);await closeDay(q);assert.equal((await read(q)).history[0].grant,0);
  });
  await c.close();
 }finally{await b.close();}
 const w=await webkit.launch({headless:true});
 try{
  const c=await w.newContext({...devices['iPhone 14'],reducedMotion:'reduce'}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  await check('iPhone: investment options are readable, taps upgrade, and shelf art matches the upgraded exhibit',async()=>{
   await a(p,'tab','collection').tap();await a(p,'select','clock').tap();const card=p.locator('.branch-card').first();
   assert.match(await card.innerText(),/利益/);await card.scrollIntoViewIfNeeded();const box=await card.boundingBox();assert(box.height>=44);assert(box.width>200);assert(box.x>=0&&box.x+box.width<=390);
   await card.tap();assert.equal((await read(p)).collection[0].level,2);
   assert((await p.locator('.detail-hero svg').innerHTML()).includes('#6a9690'));
   await a(p,'upgrade','clock').tap();assert.equal((await read(p)).collection[0].level,3);
   assert((await p.locator('.detail-hero svg').innerHTML()).includes('#325b50'));
   await p.screenshot({path:'artifacts/growth-iphone-level3.png',scale:'css'});
   await a(p,'tab','collection').tap();assert((await a(p,'select','clock').innerHTML()).includes('#325b50'));
  });
  await check('iPhone: budget forecasts, capacity and help remain accessible without horizontal overflow',async()=>{
   await a(p,'tab','museum').tap();await a(p,'museum-panel').tap();assert.equal(await p.locator('.panel-body').evaluate(el=>el.scrollTop),0);
   await p.locator('.capacity-breakdown').scrollIntoViewIfNeeded();assert.match(await p.locator('.capacity-breakdown').innerText(),/接客枠.*人/s);
   await p.locator('#toast.visible').waitFor({state:'hidden'});
   await p.screenshot({path:'artifacts/growth-iphone-budget.png',scale:'css'});
   assert(await p.locator('.panel-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.evaluate(()=>visualViewport.scale),1);
   await a(p,'help').tap();await p.getByText('利益を増やすコツ',{exact:true}).tap();await p.getByText('このゲームについて',{exact:true}).tap();await p.getByText('奇妙な収集館 v0.3。',{exact:false}).scrollIntoViewIfNeeded();
  });
 }finally{await w.close();}
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/growth-browser-results.json',JSON.stringify({results,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
