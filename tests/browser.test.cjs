const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts');
const base=process.env.MUSEUM_TEST_URL||'http://127.0.0.1:4173';
const key='curio-museum.save.v1';
const results=[],errors=[];
const action=(page,name,id)=>page.locator(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`);
async function check(name,fn){await fn();results.push({name,status:'passed'});console.log(`PASS ${name}`);}
async function stored(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function closeSummary(page){await page.locator('[data-modal-action="close"]').last().click();}
async function openAndFinish(page){await action(page,'open').click();await page.waitForTimeout(550);await action(page,'finish').click();await page.locator('[data-modal-action="confirm"]').click();await page.getByRole('heading',{name:/営業記録$/}).waitFor();await closeSummary(page);}
async function noOverflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal document overflow');}
async function screenshot(page,name){await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});}

(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.MUSEUM_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const desktop=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  const page=await desktop.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#museum-board').waitFor();await screenshot(page,'desktop-initial');
  await check('desktop: place from collection, honor occupied tile, then earn income',async()=>{
   await action(page,'tab','collection').click();await action(page,'select','musicbox').click();await action(page,'place-select','musicbox').click();
   await page.locator('[data-tile-x="1"][data-tile-y="1"]').click();await page.getByText('ここにはすでに設備があります。',{exact:true}).waitFor();
   assert.equal((await stored(page)).placements.length,3);
   await page.locator('[data-tile-x="2"][data-tile-y="1"]').click();await action(page,'confirm-place').click();assert((await stored(page)).placements.some(p=>p.id==='musicbox'));
   const before=(await stored(page)).coins;await openAndFinish(page);const after=await stored(page);assert(after.coins>before);assert.equal(after.day,2);
  });
  await check('desktop: repair, display, select upgrade branch and finish tutorial',async()=>{
   await action(page,'tab','workshop').click();await action(page,'repair','mask').click();await openAndFinish(page);
   await action(page,'tab','collection').click();await action(page,'select','mask').click();await action(page,'place-select','mask').click();
   await page.locator('[data-tile-x="4"][data-tile-y="0"]').click();await action(page,'confirm-place').click();
   await page.locator('[data-object="mask"]').click();
   await page.locator('[data-action="upgrade"][data-id="mask"][data-branch="quality"]').click();
   const s=await stored(page);assert.equal(s.tutorial,5);assert.equal(s.collection.find(i=>i.id==='mask').branch,'quality');
   await action(page,'back-panel').click();await screenshot(page,'desktop-progress');
  });
  await check('desktop: research returns the promised item and survives reload',async()=>{
   await action(page,'tab','expedition').click();await action(page,'expedition','market').click();assert.equal((await stored(page)).expedition.item,'train');
   await page.reload();assert.equal((await stored(page)).expedition.item,'train');await openAndFinish(page);
   assert.equal((await stored(page)).collection.find(i=>i.id==='train').status,'damaged');
  });
  await check('desktop: an info dialog pauses an opening day',async()=>{
   await action(page,'open').click();await page.waitForTimeout(700);await action(page,'help').click();
   const before=await page.locator('#open-meta').textContent();await page.waitForTimeout(1200);const after=await page.locator('#open-meta').textContent();assert.equal(before,after);
   await page.keyboard.press('Escape');await action(page,'finish').click();await page.locator('[data-modal-action="confirm"]').click();await closeSummary(page);
  });
  await check('save: export/import roundtrip and invalid import leaves state intact',async()=>{
   await action(page,'help').click();await page.locator('[data-modal-action="info-tab"][data-id="settings"]').click();
   const before=await stored(page);const downloadEvent=page.waitForEvent('download');await page.locator('[data-modal-action="export"]').click();const download=await downloadEvent;
   const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(exported.day,before.day);
   await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
   await page.getByText('JSON形式のセーブファイルを選んでください。',{exact:true}).waitFor();assert.deepEqual(await stored(page),before);
   exported.name='星と歯車の収集館';await page.locator('#import-file').setInputFiles({name:'museum.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
   await page.locator('[data-modal-action="confirm"]').click();assert.equal((await stored(page)).name,'星と歯車の収集館');
   await page.reload();assert.equal(await page.locator('h1').textContent(),'星と歯車の収集館');
  });
  await check('save: a second tab prevents stale writes in the first tab',async()=>{
   const other=await desktop.newPage();await other.goto(base);await other.locator('[data-action="ticket"][data-value="20"]').click();
   await page.getByText('別のタブでセーブが更新されました。',{exact:false}).first().waitFor();assert(await action(page,'open').isDisabled());
   const latest=await stored(other);
   await action(page,'help').click();await page.locator('[data-modal-action="info-tab"][data-id="settings"]').click();
   await page.locator('[data-modal-action="reset-confirm"]').click();await page.getByRole('heading',{name:'別のタブの進行を確認'}).waitFor();
   assert.deepEqual(await stored(other),latest);await closeSummary(page);await other.close();
  });
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.locator('#museum-board').waitFor();
  await check('mobile: main action is on screen; tabs, selection and accessible placement work',async()=>{
   await noOverflow(phone);const box=await action(phone,'open').boundingBox();assert(box.y+box.height<=844);
   await screenshot(phone,'mobile-initial');
   await action(phone,'tab','collection').tap();await screenshot(phone,'mobile-collection');
   await action(phone,'select','musicbox').tap();await action(phone,'place-select','musicbox').tap();
   await action(phone,'place-list').tap();await phone.locator('[data-modal-action="place-at"][data-x="2"][data-y="1"]').tap();
   await action(phone,'confirm-place').tap();
   assert((await stored(phone)).placements.some(p=>p.id==='musicbox'));
   await action(phone,'zoom').tap();await action(phone,'zoom').tap();
   await phone.locator('[data-object="plant-1"]').tap();await action(phone,'remove-decor').tap();
   await phone.locator('[data-modal-action="confirm"]').tap();assert(!(await stored(phone)).placements.some(p=>p.id==='plant-1'));
   await action(phone,'tab','museum').tap();
   await action(phone,'open').tap();await phone.waitForTimeout(1000);await screenshot(phone,'mobile-open');await action(phone,'finish').tap();await phone.locator('[data-modal-action="confirm"]').tap();await closeSummary(phone);
  });
  await check('mobile: repair and later display, plus long help and editable name',async()=>{
   await action(phone,'tab','workshop').tap();await action(phone,'repair','mask').tap();await screenshot(phone,'mobile-workshop');await openAndFinish(phone);
   await action(phone,'tab','collection').tap();await action(phone,'select','mask').tap();await screenshot(phone,'mobile-detail');
   await action(phone,'place-select','mask').tap();await action(phone,'place-list').tap();await phone.locator('[data-modal-action="place-at"][data-x="4"][data-y="0"]').tap();await action(phone,'confirm-place').tap();
   await action(phone,'help').tap();await phone.getByText('利益を増やすコツ',{exact:true}).tap();await screenshot(phone,'mobile-help');
   await phone.locator('[data-modal-action="info-tab"][data-id="settings"]').tap();await phone.locator('#museum-name').fill('月と星の収集館');await phone.getByRole('button',{name:'保存',exact:true}).tap();
   assert.equal((await stored(phone)).name,'月と星の収集館');await phone.keyboard.press('Escape');await phone.reload();assert.equal(await phone.locator('h1').textContent(),'月と星の収集館');await noOverflow(phone);
  });
  await check('responsive: no horizontal page overflow at 320, 768, 1280 and 1728 pixels',async()=>{
   for(const width of [320,768,1280,1728]){await page.setViewportSize({width,height:900});await page.reload();await noOverflow(page);}
   await page.setViewportSize({width:1440,height:960});
  });
  await check('save: corrupt data is preserved, recovery reset works without stale Escape lock',async()=>{
   const recovery=await browser.newContext();await recovery.addInitScript(k=>localStorage.setItem(k,'{bad'),key);
   const rpage=await recovery.newPage();await rpage.goto(base);await rpage.getByRole('heading',{name:'セーブを読み込めません'}).waitFor();
   assert.equal(await rpage.evaluate(k=>localStorage.getItem(k),key),'{bad');
   await rpage.locator('[data-modal-action="reset-confirm"]').click();await rpage.locator('[data-modal-action="confirm"]').click();
   await action(rpage,'help').click();await rpage.keyboard.press('Escape');await action(rpage,'open').click();assert((await stored(rpage)).session);await recovery.close();
  });
  const engine=await import(pathToFileURL(path.join(root,'src/engine.js')));
  await check('later game: expanded room with a collection renders at desktop and mobile sizes',async()=>{
   let s=engine.initialState();s.coins=20000;
   for(const id of ['room','room','room','lighting','lighting','workshop','workshop'])s=engine.command(s,'facility',{id}).state;
   for(const item of ARTIFACTSForScene())if(!s.collection.find(i=>i.id===item))s.collection.push({id:item,status:'ready',level:1,branch:null});
   s.collection.forEach(i=>i.status='ready');
   for(const [id,x,y] of [['musicbox',2,1],['mask',5,1],['ruby',5,2],['train',1,3],['tarot',3,3],['radio',4,3],['beetle',5,4],['orrery',1,4]])s=engine.command(s,'place',{id,x,y}).state;
   s=engine.command(s,'decor',{kind:'bench',x:3,y:0}).state;s.tutorial=5;
   assert(engine.validateSave(s).ok);
   const gallery=await browser.newContext({viewport:{width:1440,height:960}});await gallery.addInitScript(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s});
   const gpage=await gallery.newPage();await gpage.goto(base);await screenshot(gpage,'desktop-expanded');await gpage.setViewportSize({width:390,height:844});await screenshot(gpage,'mobile-expanded');await noOverflow(gpage);await gallery.close();
  });
  assert.deepEqual(errors,[],'Browser JavaScript exceptions');
  await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));
  console.log(`${results.length} browser checks passed. No page exceptions.`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
function ARTIFACTSForScene(){return ['ruby','train','tarot','radio','beetle','orrery'];}
