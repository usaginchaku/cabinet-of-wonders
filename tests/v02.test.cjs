const {chromium,webkit,devices}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const base=process.env.MUSEUM_TEST_URL||'http://127.0.0.1:4173',key='curio-museum.save.v1',results=[],errors=[];
const a=(p,n,id)=>p.locator(`[data-action="${n}"]${id?`[data-id="${id}"]`:''}`);
const read=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const tile=(p,x,y)=>p.locator(`[data-tile-x="${x}"][data-tile-y="${y}"]`);
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
const image=(p,name)=>p.screenshot({path:`artifacts/v02-${name}.png`,fullPage:true,scale:'css'});
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.MUSEUM_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const p=await b.newPage({viewport:{width:1440,height:960}});p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  await check('hover: empty floor has no idle highlight; ghost previews without committing and invalid locations cannot confirm',async()=>{
   await tile(p,2,1).hover();assert.equal(await tile(p,2,1).locator('.tile-highlight').evaluate(e=>getComputedStyle(e).fill),'rgba(0, 0, 0, 0)');
   await a(p,'tab','collection').click();await a(p,'select','musicbox').click();await a(p,'place-select').click();
   const before=await read(p);await tile(p,2,1).hover();assert((await p.locator('#placement-preview').innerHTML()).includes('opacity=".65"'));assert.deepEqual(await read(p),before);
   assert.match(await p.locator('#placement-status').textContent(),/利益.*隣接 1組/);assert.equal(await a(p,'confirm-place').isEnabled(),false);await image(p,'desktop-preview');
   await tile(p,1,1).hover();assert(await a(p,'confirm-place').isDisabled());assert.match(await p.locator('#placement-status').textContent(),/すでに/);
   await tile(p,2,1).click();await tile(p,4,2).hover();await tile(p,4,3).focus();assert.match(await p.locator('#placement-status').textContent(),/区画 3-2/);await a(p,'confirm-place').click();assert((await read(p)).placements.some(v=>v.id==='musicbox'&&v.x===2&&v.y===1));
  });
  await check('move: existing decor previews, forecast preserves its effect, cancel preserves layout',async()=>{
   await p.locator('[data-object="plant-1"]').click();await a(p,'move').click();const before=await read(p);
   await tile(p,0,0).hover();assert.match(await p.locator('#placement-status').textContent(),/利益 \+0 G/);assert.equal(await p.locator('.moving-origin').count(),1);
   await a(p,'cancel-place').click();assert.deepEqual(await read(p),before);
   await p.locator('[data-object="plant-1"]').click();await a(p,'move').click();await tile(p,0,0).click();await a(p,'confirm-place').click();
   const moved=await read(p);assert.equal(moved.coins,before.coins);assert.equal(moved.placements.length,before.placements.length);assert(moved.placements.some(v=>v.id==='plant-1'&&v.kind==='plant'&&v.x===0&&v.y===0));
  });
  await check('closing: cancel and Escape preserve day, confirmation pauses time and settles exactly once',async()=>{
   await a(p,'open').click();await p.waitForTimeout(650);await a(p,'finish').click();await p.getByRole('heading',{name:'今日の営業を終了しますか？'}).waitFor();
   const elapsed=await p.locator('#open-meta').textContent();await p.waitForTimeout(1100);assert.equal(await p.locator('#open-meta').textContent(),elapsed);
   await p.getByRole('button',{name:'キャンセル',exact:true}).click();assert((await read(p)).session);assert.equal((await read(p)).day,1);
   await a(p,'finish').click();await p.keyboard.press('Escape');assert((await read(p)).session);
   await a(p,'pause').click();const paused=await read(p);await p.waitForTimeout(650);await a(p,'speed').click();await a(p,'speed').click();assert.equal((await read(p)).session.elapsed,paused.session.elapsed);assert.equal((await read(p)).preferences.speed,4);
   await p.reload();assert.equal((await read(p)).session.paused,true);await a(p,'finish').click();await p.locator('[data-modal-action="confirm"]').click();await p.getByRole('heading',{name:'1日目の営業記録'}).waitFor();
   assert.equal((await read(p)).history.length,1);assert((await read(p)).history[0].feedback.length);await p.getByText('来館者の声',{exact:true}).waitFor();
   await p.locator('[data-modal-action="close"]').last().click();
  });
  await check('curator: hire, depart during open hours, show visitor feedback and preserve partial research after closing',async()=>{
   await a(p,'tab','expedition').click();await a(p,'curator').click();assert.equal((await read(p)).curator.level,1);
   await a(p,'open').click();await p.waitForTimeout(650);await a(p,'tab','expedition').click();assert(await a(p,'expedition','market').isEnabled());await a(p,'expedition','market').click();assert.match(await p.locator('.job-copy').textContent(),/あと2回の閉館/);
   assert((await read(p)).expedition.startedElapsed>0);assert((await p.locator('#visitor-feedback').textContent()).length>0);await image(p,'desktop-curator');
   await a(p,'finish').click();await p.locator('[data-modal-action="confirm"]').click();assert((await read(p)).expedition.progress>0);assert((await read(p)).expedition.progress<1);
  });
 }finally{await b.close()}
 const w=await webkit.launch({headless:true});
 try{
  const c=await w.newContext({...devices['iPhone 14'],reducedMotion:'reduce'});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  await check('WebKit iPhone: shelf leaves room visible; touch previews, confirm and path overlay work',async()=>{
   await a(p,'tab','collection').tap();const scene=await p.locator('.scene').boundingBox(),shelf=await p.locator('.side-panel').boundingBox();
   assert(scene.width>=380);assert(scene.height>200);assert(scene.y+scene.height<=shelf.y+1);assert(shelf.height<=191);await image(p,'webkit-shelf');
   await a(p,'select','musicbox').tap();await a(p,'place-select').tap();await tile(p,2,1).tap();assert(!(await read(p)).placements.some(v=>v.id==='musicbox'));assert(await a(p,'confirm-place').isEnabled());await image(p,'webkit-preview');assert.equal(await p.evaluate(()=>visualViewport.scale),1);await a(p,'confirm-place').tap();
   assert((await read(p)).placements.some(v=>v.id==='musicbox'));await a(p,'paths').tap();assert.equal(await a(p,'paths').getAttribute('aria-pressed'),'true');await p.getByText('● 歩ける床',{exact:true}).waitFor();
   await a(p,'tab','museum').tap();await a(p,'open').tap();await a(p,'pause').tap();await image(p,'webkit-open');
  });
  const engine=await import(pathToFileURL(path.resolve('src/engine.js')));let s=engine.initialState();s.coins=10000;
  for(let i=0;i<3;i++)s=engine.command(s,'facility',{id:'room'}).state;
  await check('small mobile: maximum room, list placement, settings and help remain scrollable without overflow',async()=>{
   await c.close();const c2=await w.newContext({viewport:{width:320,height:664},isMobile:true,hasTouch:true});await c2.addInitScript(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s});const p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));await p2.goto(base);
   await a(p2,'tab','collection').tap();await a(p2,'select','musicbox').tap();await a(p2,'place-select').tap();await a(p2,'place-list').tap();for(const width of [390,320]){await p2.setViewportSize({width,height:664});assert(await p2.locator('.modal-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
   await p2.locator('[data-modal-action="place-at"][data-x="7"][data-y="6"]').tap();await a(p2,'confirm-place').tap();assert((await read(p2)).placements.some(v=>v.id==='musicbox'&&v.x===7));
   assert(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await image(p2,'webkit-320-expanded');
   await a(p2,'help').tap();await p2.getByText('利益を増やすコツ',{exact:true}).tap();await p2.getByText('このゲームについて',{exact:true}).tap();await p2.getByText('奇妙な収集館 v0.3。',{exact:false}).scrollIntoViewIfNeeded();
   await c2.close();
  });
 }finally{await w.close()}
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/v02-results.json',JSON.stringify({results,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
