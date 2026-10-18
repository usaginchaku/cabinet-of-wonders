import { ARTIFACTS, BY_ID, THEMES, ROUTES, FACILITIES, DECOR, PRICES, DAY_SECONDS, SAVE_KEY, CURATOR, THEME_GRANT } from './data.js';
import { initialState, command, dimensions, entrance, owned, positioned, forecast, audience, rank, upgradeCost, routeNext, placementError, accessibleTiles, collections, visitorFeedback, expeditionDays, expeditionCost, investmentPreview } from './engine.js';
import { loadGame, saveGame, parseImport, downloadSave, migrationBackup } from './storage.js';
import { icon, esc, money, signed } from './ui-utils.js';
import { thumbnail, renderBoard, visitorArt, iso, placementGhost } from './art.js';

const app=document.querySelector('#app'),modal=document.querySelector('#modal'),toastElement=document.querySelector('#toast');
const loaded=loadGame();
let state=loaded.state;
let storageBlocked=Boolean(loaded.error),storageWarning=loaded.error??'',externalConflict=false;
let tab='museum',selected=null,placing=null,filter='all',mobilePanel=false,zoom=false;
let toastTimer=null,lastSave=0,modalView='help',pendingImport=null,lastFocus=null;
let audioContext=null;
let openedAt=-Infinity;
let previewTile=null,placementLocked=false,showPaths=false;
let renderedPanelKey=null;
const reducedMotion=()=>!state.preferences.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
const disabled=condition=>condition?'disabled':'';
const afford=cost=>state.coins>=cost&&!state.session&&!storageBlocked&&!externalConflict;
const labelFor=id=>BY_ID[id]?.name??DECOR[positioned(state,id)?.kind]?.name??'';

function toast(text,error=false) {
  clearTimeout(toastTimer); toastElement.textContent=text;
  toastElement.className=`visible${error?' error':''}`;
  toastTimer=setTimeout(()=>toastElement.className='',error?5000:3300);
}
function chime() {
  if(!state.preferences.sound)return;
  try {
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    [523.25,659.25].forEach((frequency,i)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
      const now=audioContext.currentTime+i*.08;oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.035,now+.015);gain.gain.exponentialRampToValueAtTime(.001,now+.3);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+.32);
    });
  }catch { /* Audio is optional; a blocked audio device must not stop play. */ }
}
function persist() {
  if(storageBlocked||externalConflict)return false;
  try {saveGame(state);lastSave=Date.now();storageWarning='';return true;}
  catch {storageWarning='保存できません。設定からセーブを書き出してください。';toast(storageWarning,true);return false;}
}
function run(type,args={},options={}) {
  if(storageBlocked||externalConflict){toast('セーブの確認が必要です。上部のお知らせを開いてください。',true);return false;}
  try {
    const wasSession=Boolean(state.session),oldTutorial=state.tutorial;
    const oldThemes=type==='tick'?[]:collections(state).filter(g=>g.complete).map(g=>g.theme);
    const result=command(state,type,args);state=result.state;
    const settled=wasSession&&!state.session||type==='work';
    if(type!=='tick'||Date.now()-lastSave>2500||settled)persist();
    if(type!=='tick'||settled)render();else updateLive();
    if(result.message&&!options.silent&&!settled)toast(result.message);
    if(settled){chime();openSummary();}
    else if(oldTutorial<5&&state.tutorial===5){toast('開館の基本をマスターしました。ここからはあなたの収集館へ。');chime();}
    else if(type!=='tick'){
      const completed=collections(state).find(g=>g.complete&&!oldThemes.includes(g.theme));
      if(completed){toast(`「${completed.name}」のテーマ展示が完成しました。`);chime();}
    }
    return true;
  }catch(error){toast(error.message,true);return false;}
}

function navButton(id,label,name,notification=false){return `<button class="nav-button" data-action="tab" data-id="${id}" ${tab===id?'aria-current="page"':''}>${icon(name)}<span class="nav-label">${label}${notification?'<i class="nav-dot" aria-hidden="true"></i>':''}</span></button>`;}
function header(){return `<header class="topbar"><div class="brand"><div class="brand-mark">${icon('museum')}</div><div><h1>${esc(state.name)}</h1></div></div><div class="top-stats"><div class="balance">${icon('coin')}<span id="balance">${money(state.coins)}<small>G</small></span></div><div class="reputation" title="評判。満足度の高い営業で上がります。">${icon('star')}<span>${state.reputation}<small> / 100</small></span></div></div><div class="header-actions"><span class="save-state">${icon(storageWarning?'alert':'save')}<span>${storageWarning?'未保存':'自動保存'}</span></span><button class="icon-button info-button" data-action="help" aria-label="遊び方と設定" title="遊び方と設定">${icon('info')}</button></div></header>`;}

function operatingControls(){
  const report=state.session?.report??forecast(state);
  if(placing)return `<div class="placing-controls"><div><strong>${esc(placing.kind?DECOR[placing.kind].name:labelFor(placing.id))}</strong><small id="placement-status" role="status">床をクリック／タップして選択</small></div><button class="icon-button" data-action="place-list" aria-label="配置場所を一覧で選ぶ">${icon('list')}</button><button class="icon-button" data-action="cancel-place" aria-label="配置をやめる">${icon('close')}</button><button class="button" data-action="confirm-place" disabled>${icon('check')}ここに置く</button></div>`;
  return `<div class="open-area"><div class="open-meta" id="open-meta">${state.session?'':`次の営業 <b>${signed(report.net)} G</b><br>${report.visitors}人の来館見込み`}</div>${state.session?`<div class="time-controls"><button class="icon-button" data-action="pause" aria-label="${state.session.paused?'営業を再開':'営業を一時停止'}">${icon(state.session.paused?'play':'pause')}</button><button class="speed-button" data-action="speed" data-value="${state.preferences.speed===4?1:state.preferences.speed*2}" aria-label="営業速度 ${state.preferences.speed}倍・クリックで切替">${state.preferences.speed}×</button></div>`:''}<button class="button open-button" data-action="${state.session?'finish':'open'}" ${disabled(storageBlocked||externalConflict||(!state.session&&!report.visitors))}>${icon(state.session?'fast':'play')}<span>${state.session?'閉館する':'開館する'}</span></button></div>`;
}
function render(){
  const panelKey=`${tab}:${selected??''}:${filter}:${Boolean(placing)}`;
  const panelScroll=panelKey===renderedPanelKey?(app.querySelector('.panel-body')?.scrollTop??0):0;
  const active=document.activeElement,focusData=active&&app.contains(active)?{...active.dataset}:null;
  const size=dimensions(state),free=size.width*size.height-state.placements.length-1;
  app.innerHTML=`<main class="game-shell">
    ${header()}
    <div class="play-area ${mobilePanel&&!placing?'has-panel':''}">
      <section class="scene" aria-label="収集館">
        <div class="scene-top"><div class="day-block"><span class="day-label">${state.day}日目</span><span class="status-chip ${state.session?'is-open':''}"><i class="status-dot"></i><span id="opening-status">${state.session?(state.session.paused?'一時停止':'開館中'):'開館準備'}</span></span></div><span class="scene-badge">空き床 ${free} / ${size.width*size.height}</span></div>
        <div class="board-scroll"><div class="board-inner ${zoom?'zoomed':''}">${renderBoard(state,{selected,placing,paths:showPaths,preview:previewTile})}</div></div>
        <div class="visitor-feedback" id="visitor-feedback" aria-live="polite"></div>
        <div class="scene-bottom">${showPaths?'<span class="path-legend">● 歩ける床</span>':''}<div class="scene-tools"><button class="tool-button ${showPaths?'active':''}" data-action="paths" aria-pressed="${showPaths}">${icon('route')}通路</button><button class="icon-button" data-action="zoom" aria-label="${zoom?'全体を表示':'見取り図を拡大'}">${icon(zoom?'minus':'plus')}</button><button class="tool-button" data-action="museum-panel">${icon('settings')}設備・料金</button></div></div>
        ${state.session?'<div class="session-progress"><div id="day-progress"></div></div>':''}
      </section>
      <aside class="side-panel ${mobilePanel&&!placing?'mobile-open':''} ${tab==='collection'&&!selected?'collection-shelf':''}" aria-label="${panelTitle()}">${renderPanel()}</aside>
    </div>
    <footer class="bottom-bar"><nav class="main-nav" aria-label="ゲームのメニュー">${navButton('museum','収集館','museum')}${navButton('collection','収蔵庫','collection',state.collection.some(i=>i.status==='ready'&&!positioned(state,i.id)))}${navButton('workshop','工房','hammer',state.collection.some(i=>i.status==='damaged'))}${navButton('expedition','調査','compass')}</nav>${operatingControls()}</footer>
  </main>${storageWarning||externalConflict?`<div class="save-warning">${esc(externalConflict?'別のタブでセーブが更新されました。':storageWarning)}<button data-action="save-recovery">確認</button></div>`:''}`;
  renderedPanelKey=panelKey;
  const panel=app.querySelector('.panel-body');if(panel)panel.scrollTop=panelScroll;
  if(focusData){
    const fields=focusData.action?['action','id','value','branch']:['tileX','tileY'];
    const target=[...app.querySelectorAll('[data-action],[data-tile-x]')].find(el=>fields.every(key=>el.dataset[key]===focusData[key]));
    target?.focus({preventScroll:true});
  }
  if(placing&&previewTile)updatePlacement(previewTile.x,previewTile.y);
  updateLive();drawVisitors();
}

function panelTitle(){if(selected&&!placing)return labelFor(selected);return {museum:'開館の準備',collection:'収蔵庫',workshop:'修復工房',expedition:'収集の旅'}[tab];}
function renderPanel(){
  const title=selected&&!placing?'収蔵品の詳細':panelTitle();
  return `<div class="panel-head"><div><h2>${title}${tab==='collection'&&!selected?`<span class="count">${state.collection.length} / ${ARTIFACTS.length}</span>`:''}</h2></div>${selected&&!placing?`<button class="icon-button" data-action="back-panel" aria-label="一覧に戻る">${icon('chevron','back-icon')}</button>`:`<button class="icon-button panel-close" data-action="close-panel" aria-label="パネルを閉じる">${icon('close')}</button>`}</div><div class="panel-body">${selected&&!placing?detailPanel():tab==='museum'?museumPanel():tab==='collection'?collectionPanel():tab==='workshop'?workshopPanel():expeditionPanel()}</div>`;
}
function investmentImpact(type,args={}){
  const change=investmentPreview(state,type,args);
  if(!change)return '';
  return `<span class="investment-impact">利益 ${signed(change.profit)} G / 日${change.capacity?` · 受入 ${signed(change.capacity)}人`:''}${change.satisfactionChange?`<span>満足度 ${change.satisfaction}%</span>`:''}${change.grant?`<span>初公開で支援金 +${change.grant} G</span>`:''}</span>`;
}
function facilityRow(id){
  const def=FACILITIES[id],level=state.facilities[id],cost=def.costs[level-1];
  return `<div class="facility-row"><div class="facility-icon">${icon(def.icon)}</div><div class="facility-content"><strong>${def.name} <small style="display:inline">Lv.${level}</small></strong><small>${level<=def.costs.length?def.benefits[level-1]:'改良完了'}</small>${level<=def.costs.length&&id!=='workshop'?investmentImpact('facility',{id}):''}</div>${level<=def.costs.length?`<button class="cost-button" data-action="facility" data-id="${id}" ${disabled(!afford(cost))} aria-label="${def.name}を改良 ${cost} G">${money(cost)} G ${icon('plus')}</button>`:icon('check')}</div>`;
}
function museumPanel(){
  const report=state.session?.report??forecast(state),guest=audience(state);
  return `<div class="audience"><div class="audience-portrait">${icon('people')}</div><div><p>${guest.name}が訪れる日</p><small>「${THEMES[guest.theme].name}」の展示が人気</small></div></div><div class="forecast"><dl><dt>来館見込み</dt><dd>${report.visitors}<small> 人</small></dd></dl><dl><dt>営業利益の見込み</dt><dd class="profit ${report.operatingNet<0?'negative':''}">${signed(report.operatingNet)}<small> G</small></dd></dl></div><p class="capacity-note">来館希望 ${report.demand}人 <span>受入 ${report.capacity}人</span></p><div class="capacity-breakdown"><span>接客枠 ${report.serviceCapacity}人</span><span>通路の広さ ${report.floorCapacity}人分</span></div>${report.grant?`<p class="grant-note">初公開の支援金 +${report.grant} G</p>`:''}<div class="ticket-block"><div class="section-label">入館料 <small>満足度の見込み ${report.satisfaction}%</small></div><div class="segmented" role="group" aria-label="入館料">${PRICES.map(p=>`<button data-action="ticket" data-value="${p}" aria-pressed="${state.ticket===p}" ${disabled(Boolean(state.session))}>${p} G</button>`).join('')}</div></div><div class="facilities"><div class="section-label">館の設備 <small>相乗効果 ${report.synergy}組</small></div>${facilityRow('lighting')}${facilityRow('room')}${collectionGoals()}<div class="decor-row">${Object.entries(DECOR).map(([id,d])=>`<button class="decor-button" data-action="decor-select" data-id="${id}" ${disabled(!afford(d.cost))}>${icon(id)}<span><strong>${d.name}</strong><small>${d.cost} G</small><small>${id==='bench'?'接客枠 +3人':'満足度 +3%・4個まで'}</small></span></button>`).join('')}</div></div>${state.history.length?`<button class="quiet-link" data-action="history">${icon('book')}営業記録を見る ${icon('chevron')}</button>`:''}`;
}
function statusLabel(item){return item.status==='damaged'?'未修復':item.status==='repairing'?`あと${item.remaining}日`:positioned(state,item.id)?'展示中':'収蔵中';}
function collectionPanel(){
  const list=state.collection.filter(item=>filter==='all'||filter==='ready'&&item.status==='ready'||filter==='damaged'&&item.status!=='ready');
  return `<div class="chips" role="group" aria-label="収蔵品の絞り込み">${[['all','すべて'],['ready','修復済み'],['damaged','修復待ち']].map(([id,label])=>`<button class="filter-button ${filter===id?'active':''}" data-action="filter" data-id="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>${list.length?`<div class="collection-grid">${list.map(item=>{const def=BY_ID[item.id];return `<button class="collection-card" data-action="select" data-id="${item.id}" aria-label="${def.name} ${statusLabel(item)}"><span class="mini-state">${statusLabel(item)}</span>${thumbnail(def.art,item.status==='damaged'?'damaged-art':'',item.level)}<strong>${def.name}</strong><small>${THEMES[def.theme].name} · Lv.${item.level}</small></button>`;}).join('')}</div>`:`<div class="empty-state">${icon('collection')}この条件の収蔵品はありません。</div>`}`;
}
function detailPanel(){
  const item=owned(state,selected),p=positioned(state,selected);
  if(!item&&p?.kind){const def=DECOR[p.kind];return `<div class="detail-hero">${thumbnail(def.art)}</div><h3>${def.name}</h3><p class="detail-description">${def.description}。場所は何度でも無料で変えられます。</p><button class="button full" data-action="move" data-id="${p.id}" ${disabled(Boolean(state.session))}>${icon('move')}移動する</button><button class="quiet-link" data-action="remove-decor" data-id="${p.id}" ${disabled(Boolean(state.session))}>${icon('store')}撤去する · ${Math.floor(def.cost/2)} G 回収</button>`;}
  if(!item){selected=null;return museumPanel();}
  const def=BY_ID[item.id];
  const actualAppeal=Math.round(def.appeal*(1+(item.level-1)*.3+(item.branch==='quality'?.25:0)));
  return `<div class="detail-hero"><span class="chip">${THEMES[def.theme].name}</span>${thumbnail(def.art,'',item.level)}</div><h3>${def.name}</h3><details class="object-description"><summary>収蔵品の説明</summary><p>${def.description}</p></details><div class="detail-stats"><span>展示の魅力<strong>${actualAppeal}</strong></span><span>レベル<strong>${item.level}<small> / 3</small></strong></span><span>状態<strong style="font-size:13px;padding-top:5px">${statusLabel(item)}</strong></span></div>${item.status==='damaged'?`<button class="button full" data-action="repair" data-id="${item.id}" ${disabled(!afford(def.repair)||repairFull())}>${icon('hammer')}修復する · ${def.repair} G</button><p class="panel-note">修復に ${Math.max(1,def.days-(state.facilities.workshop===3?1:0))}営業日${repairFull()?'。現在、工房は満員です。':''}</p>`:item.status==='repairing'?`<div class="job-card"><div class="job-copy"><strong>工房で修復中</strong><small>あと${item.remaining}営業日で完成します。</small></div>${icon('hammer')}</div>`:`<div class="action-row"><button class="button" data-action="${p?'move':'place-select'}" data-id="${item.id}" ${disabled(Boolean(state.session))}>${icon(p?'move':'plus')}${p?'移動する':'展示する'}</button>${p?`<button class="button secondary" data-action="store" data-id="${item.id}" ${disabled(Boolean(state.session))}>${icon('store')}収蔵庫へ</button>`:''}</div>${upgradePanel(item)}`}${def.reference?`<p class="reference">${esc(def.reference)}</p>`:''}`;
}
function upgradePanel(item){
  if(item.level===3)return `<div class="upgrade-section"><span class="chip">${icon('check')} ${item.branch==='quality'?'鑑賞重視':'回転重視'}・改良完了</span></div>`;
  const cost=upgradeCost(item);
  return `<div class="upgrade-section"><div class="section-label">展示を改良 <small>Lv.${item.level} → ${item.level+1}</small></div>${item.level===1?[['quality','鑑賞重視','魅力 +55%'],['access','回転重視','魅力 +30%・接客枠 +6人']].map(([id,title,copy])=>`<button class="branch-card" data-action="upgrade" data-id="${item.id}" data-branch="${id}" ${disabled(!afford(cost))}><span><strong>${title}</strong><small>${copy}</small>${investmentImpact('upgrade',{id:item.id,branch:id})}</span><span class="branch-price">${cost} G ${icon('plus')}</span></button>`).join(''):`<button class="button secondary full" data-action="upgrade" data-id="${item.id}" ${disabled(!afford(cost))}>${icon('sparkle')}さらに磨く · ${cost} G</button><p class="panel-note">${item.branch==='quality'?'鑑賞重視':'回転重視'}のまま、魅力と接客枠が上がります。</p>${investmentImpact('upgrade',{id:item.id})}`}</div>`;
}
function repairFull(){return state.collection.filter(i=>i.status==='repairing').length>=(state.facilities.workshop>=2?2:1);}
function collectionGoals(){
  const goals=collections(state);
  return `<details class="theme-goals"><summary>テーマ展示 <span>${goals.filter(g=>g.complete).length} / 3 完成</span></summary>${goals.map(g=>`<div class="goal-row"><b>${g.name}</b><span>${g.complete?'完成 · 魅力 +12':`${g.count} / 3点 · 合計 Lv.${g.levels} / 6`}</span>${g.complete?icon('check'):''}<small>${state.milestones.includes(g.theme)?'初公開済み':`初公開で ${THEME_GRANT} G`}</small></div>`).join('')}</details>`;
}
function curatorPanel(){
  const {level,experience}=state.curator,cost=CURATOR.costs[level],required=CURATOR.experience[level];
  return `<details class="curator-card" ${level?'':'open'}><summary class="section-label">${icon('people')}調査担当 <span>${level?`Lv.${level}`:'未採用'}</span>${icon('chevron')}</summary><div class="curator-facts"><span>人件費 ${CURATOR.wages[level||1]} G / 日</span>${level?`<span>調査経験 ${experience}回</span>`:''}</div>${level===3?'<p class="panel-note">開館中の調査・接客枠 +12人・日数短縮・全展示の魅力 +15%</p>':`<div class="curator-benefit">${CURATOR.benefits[level]}${investmentImpact('curator')}${level?`<small>育成条件：調査 ${experience} / ${required}回</small><small>育成後の人件費 ${CURATOR.wages[level+1]} G / 日</small>`:''}</div><button class="button secondary full" data-action="curator" ${disabled(!afford(cost)||experience<required)}>${level?'育成する':'雇う'} · ${cost} G</button>`}</details>`;
}
function tutorialGuide(){
  return `<ol class="tutorial-guide">${[
    ['収蔵庫で品を選ぶ','修復済みのオルゴールを選び「展示する」を押します。'],
    ['床で試し置きする','マウスを動かすと半透明の展示が追従します。床のクリック／タップで候補を固定し、「ここに置く」で確定します。別の床を選ぶと候補を変えられます。'],
    ['開館して反応を見る','感想や利益を見ながら次の改善を考えます。一時停止・速度切替・確認付きの閉館ができます。'],
    ['工房で修復する','未修復品はそのままでは展示できません。工房で修復し、必要な営業日数が経つと展示できます。'],
    ['改良と調査で育てる','同じテーマを隣接させ、3点・合計レベル6のテーマ展示を目指します。調査担当を雇うと開館中にも調査へ出せます。'],
  ].map(([title,copy])=>`<li><strong>${title}</strong><p>${copy}</p></li>`).join('')}</ol>`;
}
function workshopPanel(){
  const jobs=state.collection.filter(i=>i.status==='repairing'),damaged=state.collection.filter(i=>i.status==='damaged'),slots=state.facilities.workshop>=2?2:1;
  return `<div class="section-label">修復中 <small>${jobs.length} / ${slots}枠</small></div>${jobs.length?jobs.map(i=>`<div class="job-card">${thumbnail(BY_ID[i.id].art)}<div class="job-copy"><strong>${BY_ID[i.id].name}</strong><small>あと${i.remaining}営業日</small><div class="progress-track"><span style="width:${Math.max(8,(1-i.remaining/(BY_ID[i.id].days+1))*100)}%"></span></div></div></div>`).join(''):'<p class="panel-note" style="margin:0 0 20px">修復する品を選んでください。</p>'}<div class="section-label" style="margin-top:20px">修復待ち <small>${damaged.length}点</small></div>${damaged.length?damaged.map(i=>`<div class="repair-row">${thumbnail(BY_ID[i.id].art)}<div><strong>${BY_ID[i.id].name}</strong><small>${Math.max(1,BY_ID[i.id].days-(state.facilities.workshop===3?1:0))}営業日</small></div><button class="cost-button" data-action="repair" data-id="${i.id}" aria-label="${BY_ID[i.id].name}を修復 ${BY_ID[i.id].repair} G" ${disabled(!afford(BY_ID[i.id].repair)||repairFull())}>${BY_ID[i.id].repair} G</button></div>`).join(''):'<p class="panel-note">修復待ちの品はありません。調査で新しい品を探せます。</p>'}<div style="margin-top:18px">${facilityRow('workshop')}</div><div class="work-order"><h3>工房の小仕事</h3><p>1日休館して、街の修理依頼を受けます。修復と調査も1日進みます。</p><button class="button outline full" data-action="work-confirm" ${disabled(Boolean(state.session))}>依頼を受ける · +100 G</button></div>`;
}
function expeditionClosings(){
  const job=state.expedition;
  const today=job.startedDay===state.day?1-job.startedElapsed/DAY_SECONDS:1;
  return 1+Math.ceil(Math.max(0,job.remaining-job.progress-today)-1e-9);
}
function expeditionPanel(){
  return `${curatorPanel()}${state.expedition?`<div class="job-card"><div class="facility-icon">${icon('compass')}</div><div class="job-copy"><strong>${ROUTES.find(r=>r.id===state.expedition.route).name}を調査中</strong><small>帰還まであと${expeditionClosings()}回の閉館</small><div class="progress-track"><span style="width:${(1-(state.expedition.remaining-state.expedition.progress)/state.expedition.total)*100}%"></span></div></div></div>`:''}${ROUTES.map(route=>{const next=routeNext(state,route),cost=expeditionCost(state,route);return `<article class="route-card"><div class="route-header">${thumbnail(route.art)}<div><h3>${route.name}</h3><p>${route.subtitle}</p></div></div><div class="route-body"><p><span>次の収集候補</span>${next?BY_ID[next].name:'すべての品を収集しました'}</p><div class="route-footer"><small>${icon('clock')}${expeditionDays(state,route)}営業日</small><button class="button" data-action="expedition" data-id="${route.id}" ${disabled(!next||Boolean(state.expedition)||state.coins<cost||Boolean(state.session&&!state.curator.level)||storageBlocked||externalConflict)}>${next?`${cost} G で調査`:'調査完了'}</button></div></div></article>`;}).join('')}`;
}

function beginPlacement(id,kind=null){
  if(state.session){toast('閉館後に配置できます。',true);return;}
  placing=kind?{kind}:{id};previewTile=null;placementLocked=false;mobilePanel=false;selected=id;render();
}
function selectItem(id){selected=id;placing=null;mobilePanel=true;render();}
function handleTile(x,y,id){
  if(placing){
    placementLocked=true;
    updatePlacement(x,y);
  }else if(id)selectItem(id);
}
function updatePlacement(x,y){
  if(!placing)return;
  previewTile={x,y};
  const error=placementError(state,placing.id??'_new',x,y);
  const layer=app.querySelector('#placement-preview');if(layer)layer.innerHTML=placementGhost(state,placing,previewTile);
  const status=app.querySelector('#placement-status'),confirm=app.querySelector('[data-action="confirm-place"]');
  let change='';
  if(!error){
    const id=placing.id??'_new';
    const next={...state,placements:[...state.placements.filter(p=>p.id!==id),{...positioned(state,id),id,x,y,...(placing.kind?{kind:placing.kind}:{})}]};
    const old=forecast(state),after=forecast(next);
    change=`利益 ${signed(after.operatingNet-old.operatingNet)} G / 日・受入 ${signed(after.capacity-old.capacity)}人・満足度 ${after.satisfaction}%・隣接 ${after.synergy}組${after.grant>old.grant?`・初公開 +${after.grant-old.grant} G`:""}`;
  }
  if(status){status.textContent=error??`区画 ${x+1}-${y+1} · ${change}`;status.classList.toggle('invalid',Boolean(error));}
  if(confirm)confirm.disabled=Boolean(error)||!placementLocked;
}
app.addEventListener('pointerover',event=>{const tile=event.target.closest('[data-tile-x]');if(tile&&placing&&!placementLocked&&event.pointerType!=='touch')updatePlacement(Number(tile.dataset.tileX),Number(tile.dataset.tileY));});
app.addEventListener('focusin',event=>{const tile=event.target.closest('[data-tile-x]');if(tile&&placing&&!placementLocked)updatePlacement(Number(tile.dataset.tileX),Number(tile.dataset.tileY));});
app.addEventListener('click',event=>{
  const tile=event.target.closest('[data-tile-x]');
  if(tile){handleTile(Number(tile.dataset.tileX),Number(tile.dataset.tileY),tile.dataset.tileId);return;}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const {action,id,value,branch}=button.dataset;
  switch(action){
    case 'tab': mobilePanel=id!=='museum';tab=id;selected=null;placing=null;previewTile=null;render();break;
    case 'museum-panel': tab='museum';selected=null;placing=null;mobilePanel=true;render();break;
    case 'close-panel': mobilePanel=false;selected=null;tab='museum';render();break;
    case 'back-panel': selected=null;mobilePanel=tab!=='museum';render();break;
    case 'filter': filter=id;render();break;
    case 'select': selectItem(id);break;
    case 'move':case 'place-select':beginPlacement(id);break;
    case 'decor-select':beginPlacement(null,id);break;
    case 'cancel-place':placing=null;previewTile=null;selected=null;render();break;
    case 'confirm-place':{
      if(!placing||!previewTile||!placementLocked)break;
      const {x,y}=previewTile;
      const returnTab=placing.kind||positioned(state,placing.id)?.kind?'museum':'collection';
      const success=placing.kind?run('decor',{kind:placing.kind,x,y}):run('place',{id:placing.id,x,y});
      if(success){placing=null;previewTile=null;selected=null;tab=returnTab;mobilePanel=true;render();chime();}break;
    }
    case 'paths':showPaths=!showPaths;render();break;
    case 'pause':run('pause');break;
    case 'speed':run('preferences',{speed:Number(value)});break;
    case 'curator':run('curator');break;
    case 'place-list':openLocations();break;
    case 'store':if(run('store',{id})){selected=null;render();}break;
    case 'remove-decor':{
      const p=positioned(state,id);if(!p?.kind)break;
      confirmDialog('設備を撤去する',`${DECOR[p.kind].name}を撤去し、${Math.floor(DECOR[p.kind].cost/2)} Gを回収します。`,'撤去する',()=>{if(run('store',{id})){selected=null;render();}});break;
    }
    case 'repair':run('repair',{id});break;
    case 'upgrade':if(run('upgrade',{id,branch}))chime();break;
    case 'facility':if(run('facility',{id}))chime();break;
    case 'expedition':run('expedition',{id});break;
    case 'ticket':run('ticket',{value:Number(value)});break;
    case 'open':placing=null;mobilePanel=false;if(run('open'))openedAt=performance.now();break;
    case 'finish':if(performance.now()-openedAt>=500)confirmDialog('今日の営業を終了しますか？','残り時間を早送りして、本日の売上・修復・調査を精算します。','営業を終了する',()=>run('finish'));break;
    case 'help':openInfo('help');break;
    case 'history':openInfo('history');break;
    case 'work-confirm':confirmDialog('工房の小仕事','1日休館して100 Gを受け取ります。修復と調査も1日進みます。','依頼を受ける',()=>run('work'));break;
    case 'zoom':zoom=!zoom;render();break;
    case 'dismiss-tutorial':run('dismissTutorial',{value:true});break;
    case 'tutorial-target':if(id==='mask'){tab='collection';selectItem('mask');}else{tab=id;selected=null;mobilePanel=true;render();}break;
    case 'save-recovery':openRecovery();break;
  }
});
app.addEventListener('keydown',event=>{
  if(!['Enter',' '].includes(event.key))return;
  const tile=event.target.closest('[data-tile-x]'),object=event.target.closest('[data-object]');
  if(tile){event.preventDefault();handleTile(Number(tile.dataset.tileX),Number(tile.dataset.tileY),tile.dataset.tileId);if(placing)app.querySelector('[data-action="confirm-place"]:not(:disabled)')?.focus({preventScroll:true});}
  else if(object&&!placing){event.preventDefault();selectItem(object.dataset.object);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.open){placing=null;mobilePanel=false;selected=null;render();}});

function showModal(title,body,tabs=''){
  if(!modal.open)lastFocus=document.activeElement;
  modal.innerHTML=`<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-modal-action="close" aria-label="閉じる">${icon('close')}</button></div>${tabs}<div class="modal-body">${body}</div>`;
  if(!modal.open)modal.showModal();
}
function closeModal(){modal.close();if(lastFocus?.isConnected)lastFocus.focus();else app.querySelector('[data-action=help]')?.focus();}
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});

function openInfo(view='help'){
  modalView=view;
  const tabs=`<nav class="modal-tabs" aria-label="インフォメーション">${[['help','遊び方'],['history','営業記録'],['settings','設定']].map(([id,label])=>`<button class="${view===id?'active':''}" data-modal-action="info-tab" data-id="${id}" aria-pressed="${view===id}">${label}</button>`).join('')}</nav>`;
  showModal('インフォメーション',view==='help'?helpContent():view==='history'?historyContent():settingsContent(),tabs);
}
function helpContent(){return `${[
  ['collection','収集して、飾る','収蔵庫から品を選び「展示する」。床に半透明のプレビューを出し、「ここに置く」で確定します。展示を選ぶと、移動や収蔵庫への移動ができます。'],
  ['play','開館する','標準速度で1回60秒。1×・2×・4×の切替と一時停止ができます。「閉館する」は確認してから残り時間を早送りします。入館料と展示への寄付から維持費を引いた利益が資金に加わります。寄付は展示1点あたりの魅力に比例します。'],
  ['hammer','修復して、改良する','未修復の品は工房へ。修復日数は営業または工房の小仕事で進みます。展示の改良では鑑賞重視と回転重視を選べます。'],
  ['compass','新しい品を探す','調査先ごとに収集候補が決まっています。調査隊が帰ると未修復品が届きます。担当がいない間は閉館中に出発の手配をします。調査担当を雇うと開館中にも出発でき、館長が接客に集中できるので接客枠が4人増えます。育成のたびにさらに4人増え、Lv.2で調査日数を短縮、Lv.3で全展示の魅力が上がります。集めるほど次の調査費は高くなります。過去に完了した調査も育成条件に含まれます。人件費は営業日に発生します。'],
].map(([i,title,copy])=>`<div class="help-step">${icon(i)}<div><strong>${title}</strong><p>${copy}</p></div></div>`).join('')}<details class="help-detail"><summary>利益を増やすコツ</summary><ul><li>改良ボタンの利益予測は、現在の客層・料金・配置のまま比較した1営業日あたりの変化です。人件費・維持費を含み、初公開の支援金は別に表示します。満足度が変わる場合は改良後の値も表示します。翌日以降の客層や評判によって実際の利益は変わります。収蔵中の品は展示するまで利益に影響しません。</li><li>同じテーマの展示を上下左右に隣接させると、1組につき魅力が7上がります。</li><li>その日の客層に合う展示は、来館見込みと満足度を増やします。</li><li>45 Gの入館料は単価が高い一方、来館見込みと満足度が下がります。客層によって値上げへの反応が違います。</li><li>照明は展示全体を強化。ベンチは接客枠を3人増やし、植物は4個まで来館見込みと満足度に効果があります。</li><li>満足度85%以上で評判+3、65%以上で+1、それ以下で−2。評判が上がるとお客さんが増えます。</li><li>来館希望が受入人数を超えると混雑で満足度が下がります（最大24ポイント）。受入人数は「接客枠」と「通路の広さ」の小さい方です。接客枠は回転重視の改良・ベンチ・学芸員の育成で増やせます。通路は歩ける1区画につき3人分。増築や配置の整理で広くできます。</li><li>通路は入口から各展示の隣まで必要です。通路を塞ぐ配置はできません。「通路」を押すと歩ける床を表示します。壁の絵とランプは装飾なので、前に物を置いても効果は変わりません。設備の展示照明は館全体に効きます。</li><li>テーマ展示は同じテーマの修復済み展示3点以上、合計レベル6以上で成立。1テーマにつき魅力+12・満足度+3です。隣接効果とは別に加算します。完成したテーマを初めて開館で披露すると、1回だけ500 Gの支援金が届きます。</li><li>開館途中に調査を始めた日は、残り営業時間の割合だけ作業が進みます。閉館直前の出発で1日分進むことはありません。</li></ul></details><details class="help-detail"><summary>行き詰まったとき・操作方法</summary><p>資金が足りないときは工房の小仕事を受けられます。費用は不要で、1日進めて100 Gを得られます。展示品が消えることはありません。</p><p>小さな画面では＋で見取り図を拡大し、スクロールで移動できます。配置時の一覧ボタンから、区画を文字で選ぶこともできます。TabとEnterでの操作にも対応します。</p><p>別タブへの移動中・遊び方の表示中は営業が止まります。閉じている間の進行はありません。</p></details><details class="help-detail"><summary>このゲームについて</summary><p>奇妙な収集館 v0.3。収集・修復・展示・営業・設備改良を楽しむ、小さな経営ゲームです。現在は15種類の収蔵品、3つの調査先、3段階の増築があります。</p><p>ジョジョにちなんだ収蔵品は、作品をモチーフにしたファン創作の模型や展示です。公式ゲームではありません。絵はこのゲーム用のオリジナル図案で、公式画像・音声は使用していません。</p><p>データはこのブラウザに保存します。ブラウザのデータ削除や利用URLの変更で読み出せなくなるため、設定からセーブを書き出せます。セーブの外部送信・課金・アカウント登録はありません。</p><p>操作アイコン：Lucide（ISC license）。</p></details><button class="quiet-link" data-modal-action="tutorial-replay">${icon('flag')}はじめの遊び方</button>`;}
function historyContent(){return state.history.length?state.history.map(r=>`<article class="record-row"><div class="record-top"><strong>${r.day}日目 · ${esc(r.audience)}</strong><span class="${r.net>=0?'profit':'loss'} tabular">${signed(r.net)} G</span></div><p class="record-detail">${r.visitors}人来館 · 売上 ${money(r.income)} G · 維持費 ${money(r.upkeep-r.shortfall)} G${r.visitors?` · 満足度 ${r.satisfaction}%`:''}</p>${r.completed.length?`<p class="record-completed">${r.completed.map(esc).join('<br>')}</p>`:''}${r.shortfall?'<p class="record-detail">資金不足分は免除され、評判が2下がりました。</p>':''}</article>`).join(''):`<div class="empty-state">${icon('book')}営業を終えると、ここに記録が残ります。</div>`;}
function settingsContent(){return `<form id="name-form" class="setting-row"><label for="museum-name">館の名前</label><div class="setting-inline"><input id="museum-name" name="museum-name" type="text" maxlength="20" required value="${esc(state.name)}" autocomplete="off"><button class="button" type="submit">保存</button></div></form><div class="setting-row toggle-row"><label for="motion-toggle">お客さんのアニメーション</label><input id="motion-toggle" type="checkbox" ${state.preferences.motion?'checked':''}></div><div class="setting-row toggle-row"><label for="sound-toggle">完成時の効果音</label><input id="sound-toggle" type="checkbox" ${state.preferences.sound?'checked':''}></div><div class="setting-row"><h3>セーブデータ</h3><p class="panel-note">このブラウザに自動保存されます。ファイルで持ち出すこともできます。</p><div class="settings-actions"><button class="button secondary" data-modal-action="export">${icon('download')}書き出す</button><button class="button secondary" data-modal-action="import">${icon('upload')}読み込む</button></div><input id="import-file" type="file" accept=".json,application/json" hidden><button class="quiet-link" data-modal-action="restore-backup">${icon('reset')}直前のバックアップを読み込む</button>${migrationBackup()?`<button class="quiet-link" data-modal-action="export-v1">${icon('download')}v0.1の移行前セーブを書き出す</button>`:''}</div><button class="quiet-link" data-modal-action="reset-confirm" style="color:var(--danger)">${icon('reset')}最初から始める</button>`;}
let confirmAction=null;
function confirmDialog(title,copy,label,callback){confirmAction=callback;showModal(title,`<p class="confirm-copy">${esc(copy)}</p><div class="action-row"><button class="button secondary" data-modal-action="close">キャンセル</button><button class="button" data-modal-action="confirm">${esc(label)}</button></div>`);}
function openSummary(){
  const r=state.history[0];if(!r)return;
  const events=r.completed.length?`<div class="summary-events">${r.completed.map(v=>`${icon('check')} ${esc(v)}`).join('<br>')}</div>`:'';
  showModal(`${r.day}日目の営業記録`,`<div class="summary-total"><span>本日の利益</span><strong class="tabular">${signed(r.net)}<small> G</small></strong></div><div class="summary-line"><span>来館者</span><b>${r.visitors}人</b></div><div class="summary-line"><span>入館料の売上${r.visitors?'':'・小仕事'}</span><b>${money(r.admissions??r.income)} G</b></div>${r.donations?`<div class="summary-line"><span>展示への寄付</span><b>${money(r.donations)} G</b></div>`:''}${r.grant?`<div class="summary-line"><span>初公開の支援金</span><b>${money(r.grant)} G</b></div>`:''}<div class="summary-line"><span>維持費</span><b>−${money(r.upkeep-r.shortfall)} G</b></div>${r.visitors?`<div class="summary-line"><span>満足度</span><b>${r.satisfaction}%</b></div>`:''}${r.shortfall?'<p class="panel-note">資金不足分は免除され、評判が2下がりました。</p>':''}${events}${r.feedback?.length?`<div class="summary-feedback"><h3>来館者の声</h3>${r.feedback.map(f=>`<details><summary>「${esc(f.text)}」</summary><p>${esc(f.detail)}</p></details>`).join('')}</div>`:''}<p class="summary-next">次は${audience(state).name}が訪れる日です。</p><button class="button full" data-modal-action="close">${state.day}日目の準備へ ${icon('arrow')}</button>`);
}
function openLocations(){
  if(!placing)return;
  const {width,height}=dimensions(state);
  showModal('配置場所を選ぶ',`<p class="panel-note" style="margin:0 0 14px">入口から展示までの通路を残して配置します。</p><div class="location-grid" style="grid-template-columns:repeat(${width},1fr)">${Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width),error=placementError(state,placing.id??'_new',x,y);return `<button data-modal-action="place-at" data-x="${x}" data-y="${y}" ${disabled(Boolean(error))} title="${esc(error??'ここに置く')}">${x+1}-${y+1}</button>`;}).join('')}</div>`);
}
function openRecovery(){
  if(externalConflict){showModal('別のタブの進行を確認',`<p class="confirm-copy">別のタブでセーブが更新されたため、この画面の操作を止めています。再読み込みで最新の進行を表示できます。</p><button class="button full" data-modal-action="reload">最新の進行を読み込む</button>`);return;}
  if(!storageBlocked){openInfo('settings');return;}
  showModal('セーブを読み込めません',`<p class="confirm-copy">元のデータは上書きしていません。まずファイルに保存するか、直前のバックアップを読み込めます。</p><div class="settings-actions"><button class="button secondary" data-modal-action="export-raw">元データを書き出す</button><button class="button secondary" data-modal-action="restore-backup">バックアップ</button></div><button class="quiet-link" data-modal-action="reset-confirm">新しく始める</button>`);
}
function stageImport(text){
  if(externalConflict){openRecovery();return;}
  const checked=parseImport(text);if(!checked.ok){toast(checked.error,true);return;}
  pendingImport=checked.state;
  confirmDialog('セーブを読み込む',`${pendingImport.name}・${pendingImport.day}日目・${money(pendingImport.coins)} G の進行に切り替えます。現在の進行は読み込み前にファイルへ書き出します。`,'読み込む',()=>{
    if(externalConflict){openRecovery();return;}
    if(storageBlocked){try{downloadSave(localStorage.getItem(SAVE_KEY)??'','収集館-読み込み前の元データ.json');}catch{}}
    else downloadSave(state,'収集館-読み込み前.json');
    storageBlocked=false;externalConflict=false;state=pendingImport;pendingImport=null;selected=null;placing=null;storageWarning='';persist();render();toast('セーブを読み込みました。');
  });
}
modal.addEventListener('click',event=>{
  const button=event.target.closest('[data-modal-action]');if(!button||button.disabled)return;
  const {modalAction:action,id,x,y}=button.dataset;
  if(externalConflict&&['import','restore-backup','reset-confirm'].includes(action)){openRecovery();return;}
  switch(action){
    case 'close':closeModal();break;
    case 'info-tab':openInfo(id);break;
    case 'confirm':{const callback=confirmAction;confirmAction=null;closeModal();callback?.();break;}
    case 'export':downloadSave(state);toast('セーブを書き出しました。');break;
    case 'export-v1':{const original=migrationBackup();if(original)downloadSave(original,'収集館-v0.1移行前.json');break;}
    case 'export-raw':try{downloadSave(localStorage.getItem(SAVE_KEY)??'','収集館-元データ.json');}catch{toast('データを読み出せません。',true);}break;
    case 'import':modal.querySelector('#import-file').click();break;
    case 'restore-backup':try{const raw=localStorage.getItem(`${SAVE_KEY}.backup`);if(raw)stageImport(raw);else toast('バックアップがありません。',true);}catch{toast('バックアップを読み出せません。',true);}break;
    case 'reload':location.reload();break;
    case 'reset-confirm':confirmDialog('最初から始める','現在の進行をファイルに書き出してから、新しい収集館を始めます。','新しく始める',()=>{
      if(externalConflict){openRecovery();return;}
      if(storageBlocked){try{downloadSave(localStorage.getItem(SAVE_KEY)??'','収集館-元データ.json');}catch{}}
      else downloadSave(state,'収集館-前の進行.json');
      state=initialState();storageBlocked=false;externalConflict=false;storageWarning='';tab='museum';selected=null;placing=null;mobilePanel=false;persist();render();toast('新しい収集館を始めました。');
    });break;
    case 'tutorial-replay':showModal('はじめの遊び方',tutorialGuide());break;
    case 'place-at':closeModal();handleTile(Number(x),Number(y),'');break;
  }
});
modal.addEventListener('submit',event=>{if(event.target.id==='name-form'){event.preventDefault();if(run('rename',{name:new FormData(event.target).get('museum-name')}))toast('館の名前を保存しました。');}});
modal.addEventListener('change',async event=>{
  if(event.target.id==='motion-toggle')run('preferences',{motion:event.target.checked});
  if(event.target.id==='sound-toggle'){run('preferences',{sound:event.target.checked});chime();}
  if(event.target.id==='import-file'){
    const file=event.target.files[0];if(!file)return;
    if(file.size>250000){toast('セーブファイルが大きすぎます。',true);return;}
    try{stageImport(await file.text());}catch{toast('ファイルを読み込めませんでした。',true);}
  }
});

function pathToTile(reachable,start,target){
  const queue=[start],parents=new Map([[`${start.x},${start.y}`,null]]);
  const finish=`${target.x},${target.y}`;
  for(let i=0;i<queue.length;i++){
    const p=queue[i],k=`${p.x},${p.y}`;if(k===finish)break;
    for(const n of [{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}]){
      const nk=`${n.x},${n.y}`;if(reachable.has(nk)&&!parents.has(nk)){parents.set(nk,p);queue.push(n);}
    }
  }
  if(!parents.has(finish))return [start];
  const route=[];let p=target;while(p){route.unshift(p);p=parents.get(`${p.x},${p.y}`);}return route;
}
function updateLive(){
  if(!state.session)return;
  const progress=document.querySelector('#day-progress');if(progress)progress.style.width=`${state.session.elapsed/DAY_SECONDS*100}%`;
  const meta=document.querySelector('#open-meta');if(meta)meta.innerHTML=`${state.session.paused?'一時停止':'閉館まで'} <b>${Math.ceil(DAY_SECONDS-state.session.elapsed)}秒</b><br>${state.session.report.visitors}人が来館予定`;
}
function drawVisitors(){
  const layer=document.querySelector('#visitor-layer');if(!layer)return;
  layer.querySelectorAll('[data-visitor]').forEach(node=>node.remove());
  if(!state.session)return;
  const reachable=accessibleTiles(state),door=entrance(state);
  const targets=state.placements.filter(p=>BY_ID[p.id]).map(p=>[{x:p.x,y:p.y+1},{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y-1}].find(n=>reachable.has(`${n.x},${n.y}`))).filter(Boolean);
  if(!targets.length)return;
  const elapsed=state.session.elapsed;
  const feedback=visitorFeedback(state),bubble=app.querySelector('#visitor-feedback'),message=feedback[Math.floor(elapsed/6)%feedback.length].text;
  if(bubble&&bubble.textContent!==message)bubble.textContent=message;
  const count=Math.min(9,state.session.report.visitors);
  const visitorMarkup=Array.from({length:count},(_,i)=>{
    const route=pathToTile(reachable,door,targets[i%targets.length]);
    const age=elapsed-i*.6;if(age<0)return '';
    const distance=route.length-1,cycle=(age/1.3)%(distance*2+4);
    // Pause to look at the exhibit, then walk back along the same reachable route.
    let t=reducedMotion()?distance:Math.min(distance,Math.max(0,cycle<=distance+2?cycle:distance*2+2-cycle));
    if(elapsed>DAY_SECONDS-4)t=Math.max(0,Math.min(t,(DAY_SECONDS-elapsed)/4*(route.length-1)));
    const a=route[Math.floor(t)],b=route[Math.min(Math.floor(t)+1,route.length-1)],f=t%1;
    const p=iso(a.x+(b.x-a.x)*f+.5+(i%3-1)*.12,a.y+(b.y-a.y)*f+.5);
    const bob=reducedMotion()?0:Math.sin(age*7+i)*.6;
    return `<g data-visitor="${i}" data-depth="${a.x+a.y+(b.x+b.y-a.x-a.y)*f+1}" pointer-events="none" transform="translate(${p.x.toFixed(1)} ${(p.y+bob).toFixed(1)})">${visitorArt(i)}</g>`;
  }).join('');
  const buffer=document.createElementNS('http://www.w3.org/2000/svg','g');buffer.innerHTML=visitorMarkup;
  layer.append(...buffer.children);
  [...layer.children].sort((a,b)=>Number(a.dataset.depth)-Number(b.dataset.depth)).forEach(node=>layer.append(node));
}
let lastTick=performance.now(),animationFrame=0;
function frame(now){
  const elapsed=Math.min((now-lastTick)/1000,.25);lastTick=now;
  if(state.session&&!state.session.paused&&!document.hidden&&!modal.open&&!externalConflict&&!storageBlocked){
    run('tick',{seconds:elapsed*state.preferences.speed},{silent:true});
    if(animationFrame++%3===0)drawVisitors();
  }
  requestAnimationFrame(frame);
}
window.addEventListener('beforeunload',()=>persist());
document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(document.hidden)persist();});
window.addEventListener('storage',event=>{if(event.key===SAVE_KEY&&event.newValue!==JSON.stringify(state)){externalConflict=true;render();toast('別のタブで進行が更新されました。再読み込みしてください。',true);}});
matchMedia('(max-width: 700px)').addEventListener('change',()=>render());
render();
if(storageBlocked)openRecovery();else if(loaded.fresh)persist();
requestAnimationFrame(frame);
