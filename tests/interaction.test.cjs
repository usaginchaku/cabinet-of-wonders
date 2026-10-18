const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const key='curio-museum.save.v1',results=[];
const action=(page,name)=>page.locator(`[data-action="${name}"]`);
const stored=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function check(name,fn){await fn();results.push(name);console.log(`PASS ${name}`);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MUSEUM_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('http://127.0.0.1:4173');
  await check('mobile: museum tab exposes pricing and all visible controls have 44px targets',async()=>{
   await page.locator('[data-action="tab"][data-id="museum"]').tap();
   await page.getByText('来館希望',{exact:false}).waitFor();
   const tooSmall=await page.locator('button:not(.sheet-shade)').evaluateAll(buttons=>buttons.filter(b=>{
    const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9);
   }).map(b=>({text:b.textContent,label:b.ariaLabel,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})));
   assert.deepEqual(tooSmall,[]);await page.screenshot({path:'artifacts/mobile-museum.png',fullPage:true});
   await action(page,'close-panel').last().tap();
  });
  await check('keyboard: direct exhibit selection and tile placement retain focus',async()=>{
   const object=page.locator('[data-object="clock"]');await object.focus();await page.keyboard.press('Enter');
   await page.getByRole('heading',{name:'月読みの置時計'}).waitFor();
   await action(page,'move').tap();const tile=page.locator('[data-tile-x="0"][data-tile-y="0"]');await tile.focus();await page.keyboard.press('Enter');
   assert.deepEqual(await page.evaluate(()=>({...document.activeElement.dataset})),{tileX:'0',tileY:'0',tileId:'clock'});
   await page.locator('[data-action="tab"][data-id="museum"]').tap();
   const ticket=page.locator('[data-action="ticket"][data-value="45"]');await ticket.focus();await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'45');
   await action(page,'close-panel').last().tap();
  });
  await check('time: double activation is guarded; reload resumes and real-time close settles once',async()=>{
   const before=await stored(page);
   await page.locator('.open-button').dblclick();assert((await stored(page)).session,'Second click must not fast-forward');
   await page.waitForTimeout(3000);const during=await stored(page);assert(during.session.elapsed>1);
   await page.reload();await action(page,'finish').waitFor();assert((await stored(page)).session.elapsed>=during.session.elapsed);
   await page.getByRole('heading',{name:'1日目の営業記録'}).waitFor({timeout:23000});
   const after=await stored(page);assert.equal(after.day,2);assert.equal(after.coins,before.coins+during.session.report.net);assert.equal(after.history.length,1);
   await page.waitForTimeout(600);assert.equal((await stored(page)).history.length,1);
  });
  await check('save: a conflicting tab also blocks an already-open reset confirmation',async()=>{
   await page.locator('[data-modal-action="close"]').last().click();
   await action(page,'help').click();await page.locator('[data-modal-action="info-tab"][data-id="settings"]').click();
   await page.locator('[data-modal-action="reset-confirm"]').click();
   const second=await context.newPage();await second.goto('http://127.0.0.1:4173');
   await second.locator('[data-action="tab"][data-id="museum"]').click();
   await second.locator('[data-action="ticket"][data-value="20"]').click();const latest=await stored(second);
   await page.locator('[data-modal-action="confirm"]').click();
   await page.getByRole('heading',{name:'別のタブの進行を確認'}).waitFor();assert.deepEqual(await stored(second),latest);await second.close();
  });
  await fs.writeFile('artifacts/interaction-results.json',JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
