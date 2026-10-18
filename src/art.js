import { BY_ID, DECOR } from './data.js';
import { dimensions, entrance, placementError } from './engine.js';
import { esc } from './ui-utils.js';

const palette={cream:'#f6e8c6',gold:'#b98c47',ink:'#304a43',wood:'#946a48',teal:'#538b85'};
const ellipse=(x,y,rx,ry,fill,extra='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path=(d,fill,stroke='',extra='')=>`<path d="${d}" fill="${fill}" ${stroke?`stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"`:''} ${extra}/>`;

/** Original vector sprites. All anchors sit at the object's floor contact point. */
export function objectArt(kind,{pedestal=true,level=1}={}) {
  let sprite='';
  switch(kind) {
    case 'clock':
      sprite=path('M-19-12V-61Q0-87 19-61V-12Z','#805c40','#533d2d')+path('M-14-17V-60Q0-78 14-60V-17Z','#cfa86a')+ellipse(0,-52,13,13,'#f3e6be','stroke="#765839" stroke-width="2"')+path('M0-62V-52L7-47','none','#435c53')+path('M-7-31H7V-18H-7Z','#4a665a')+`<circle cx="0" cy="-26" r="4" fill="#e5c579"/>`+path('M-23-12H23V-7H-23Z','#6b4c36'); break;
    case 'globe':
      sprite=path('M0-22V-9M-16-8H16','none','#a77e3f')+ellipse(0,-8,18,5,'#9a7144')+`<circle cy="-44" r="24" fill="#6c9c91" stroke="#d6bd7e" stroke-width="2"/>`+path('M-18-56L-8-62 0-58 3-47-5-39-4-30-12-32-16-43Z M8-53L18-49 21-39 12-30 8-39 2-41Z','#d1c590')+`<ellipse cy="-44" rx="12" ry="24" fill="none" stroke="#3b706d" opacity=".4"/><path d="M-24-44H24M-18-60Q-3-72 15-66M-24-38Q-17-16 5-18Q21-20 29-40" fill="none" stroke="#b99651" stroke-width="3"/>`; break;
    case 'musicbox':
      sprite=path('M-25-23L0-35 26-22 0-9Z','#bc9663','#725437')+path('M-25-23V-10L0 3V-9Z','#9c714b')+path('M0-9L26-22V-9L0 3Z','#7a573d')+path('M-25-24V-48L0-59V-35Z','#aa8455','#725437')+path('M-21-28V-45L-4-52V-37Z','#d9bb7f')+ellipse(1,-22,12,5,'#e5c37e')+path('M0-23V-41','none','#ba9147')+path('M-8-43Q-4-55 4-49L10-50 7-44 0-38Z','#e6dabb','#7e7658'); break;
    case 'mask':
      sprite=path('M0-10V-26M-13-9H13','none','#ad8a4e')+path('M-19-64Q0-76 19-64L17-40 9-27 0-22-9-27-17-40Z','#d9c9aa','#9b8c72')+path('M-17-60L-3-55-5-45-15-48Z M17-60L3-55 5-45 15-48Z','#4c574b')+path('M0-57L-4-40 5-40 M-7-33Q0-36 7-33','none','#95846e')+path('M-18-63L-13-66M11-64L15-62M-15-44L-10-42','none','#eee3cc'); break;
    case 'ruby':
      sprite=path('M-17-10L0-17 18-9 0-3Z','#af8845')+path('M-17-43L-10-61 9-66 20-48 12-30-5-25Z','#a33f4e','#793442')+path('M-10-61L3-48 9-66 M3-48L20-48 12-30 M3-48L-5-25-17-43Z','#d76362')+path('M-10-61L-17-43 3-48Z','#f1997a')+path('M-5-25L-6-13M12-30L8-13','none','#ac8645'); break;
    case 'tarot':
      sprite=path('M-27-57L-8-67 3-20-17-10Z','#e6d1a1','#8f6b45')+path('M-5-64L21-55 15-12-10-21Z','#436d73','#bf9b60')+path('M2-54L14-50 11-22-1-27Z','#e8d4a7')+`<circle cx="7" cy="-39" r="5" fill="#b98945"/>`+path('M-18-48L-15-55-10-50-13-44Z','#a7794a'); break;
    case 'radio':
      sprite=path('M-28-44Q-28-49-23-49H23Q28-49 28-44V-7H-28Z','#8e6144','#66472f')+path('M-23-42H3V-14H-23Z','#403e32')+Array.from({length:6},(_,i)=>path(`M${-20+i*4}-39V-17`,'none','#a3865d')).join('')+path('M8-42H23V-31H8Z','#d3c595')+`<circle cx="15" cy="-21" r="6" fill="#caa56d"/>`+path('M-15-49V-54H14V-49','none','#554633'); break;
    case 'beetle':
      sprite=path('M-25-59L22-52 25-10-22-17Z','#294d46','#be9a54')+`<ellipse cx="0" cy="-36" rx="14" ry="18" fill="#c9a24b" stroke="#efd58f" stroke-width="2"/>`+path('M0-54V-18M-11-49L-19-54M12-49L20-53M-14-36L-22-35M14-36L22-33M-10-23L-17-18M11-23L18-17','none','#b89449')+`<circle cy="-53" r="5" fill="#e4c66b"/><circle cx="-6" cy="-39" r="4" fill="#567f7c"/><circle cx="6" cy="-31" r="4" fill="#567f7c"/>`; break;
    case 'arrow':
      sprite=path('M-24-10L24-17 24-66-24-59Z','#4f6466','#ad8a4c')+path('M-17-17L12-54','none','#dbc080', 'stroke-width="4"')+path('M5-53L15-66 22-48 12-51Z','#d1ad61','#f0d590')+path('M-19-15L-18-29-8-21Z','#bfa266'); break;
    case 'butterfly':
      sprite=path('M-29-57L25-57 25-9-29-9Z','#b08b59','#765c3e')+path('M-24-52H20V-14H-24Z','#ede1be')+path('M-2-34Q-28-63-21-29Q-26-12-3-27Q21-9 15-30Q25-61-2-34Z','#548f89','#326e70')+path('M-2-41V-23M-2-39L-6-45M-2-39L2-45','none','#354b46')+path('M-17-40L-6-32-19-25M12-42L2-32 12-24','none','#b3d2bb'); break;
    case 'train':
      sprite=path('M-31-17L7-34 32-21-5-4Z','#775539')+path('M-25-33L-10-40 12-27-1-20Z','#c3a566')+path('M-25-33V-19L-1-7V-20Z','#426d63')+path('M-1-20L12-27V-15L-1-7Z','#2d5249')+path('M6-42L22-34 22-19 6-26Z','#bb9557')+path('M7-43L23-35 28-38 12-46Z','#e0bf79')+path('M-16-37V-52L-8-48V-33Z','#6d7160')+`<circle cx="-17" cy="-17" r="6" fill="#d4b26a" stroke="#705d3f"/><circle cx="-3" cy="-10" r="6" fill="#d4b26a" stroke="#705d3f"/>`; break;
    case 'orrery':
      sprite=path('M0-40V-8M-20-7H20','none','#a27b3e')+`<circle cy="-46" r="11" fill="#d6ac55"/><ellipse cy="-45" rx="33" ry="13" fill="none" stroke="#b59354" stroke-width="2"/><ellipse cy="-45" rx="21" ry="32" transform="rotate(35 0 -45)" fill="none" stroke="#d3b573" stroke-width="2"/><circle cx="-27" cy="-37" r="6" fill="#5f9290"/><circle cx="13" cy="-69" r="5" fill="#b87561"/>`; break;
    case 'colosseum':
      sprite=ellipse(0,-18,31,16,'#b5a07a')+path('M-31-18V-43Q0-66 31-43V-18Q0 5-31-18Z','#c9b48d','#a79372')+ellipse(0,-43,31,14,'#e9d8b3')+ellipse(0,-43,21,8,'#8e8263')+Array.from({length:7},(_,i)=>path(`M${-25+i*8}-${24+Math.abs(3-i)*2}v-9q3-4 5 0v9z`,'#7e7c60')).join('')+path('M-30-34Q0-11 30-34','none','#ae956c'); break;
    case 'automaton':
      sprite=path('M-10-8L-8-29 8-29 11-8M-6-35L-17-27-24-42M7-35L19-26 25-34','none','#9d7b47','stroke-width="6"')+path('M-9-43L9-43 12-25-11-25Z','#567f68','#345f54')+`<circle cy="-53" r="11" fill="#d8b984"/>`+path('M-17-59H16L11-63H-11Z','#7c683d')+path('M-6-68H8V-60H-6Z','#8e7846')+`<circle cx="-4" cy="-53" r="1.5" fill="#4a5344"/><circle cx="4" cy="-53" r="1.5" fill="#4a5344"/>`+path('M-31-44L-16-48-18-34-27-32Z','#bb9258'); break;
    case 'airship':
      sprite=ellipse(0,-47,36,20,'#dfc590','stroke="#ad8b57" stroke-width="1.5"')+`<ellipse cy="-47" rx="36" ry="9" fill="none" stroke="#b79b69"/>`+path('M-30-56Q-5-73 30-53','none','#f6e4bc')+path('M-12-29L-8-18H9L14-30M-10-17L9-17 14-24-14-24Z','#8e6745','#755236')+path('M29-47L42-58 40-38Z','#b9955f'); break;
    case 'plant':
      return ellipse(0,1,20,8,'#284e4320')+path('M-13-20L-9 0Q0 7 9 0L13-20Z','#bd8d6b','#9b7054')+ellipse(0,-20,13,5,'#694f37')+path('M0-16V-62','none','#486d49','stroke-width="3"')+path('M0-32Q-30-40-20-57Q-1-55 0-32M0-39Q27-46 19-62Q1-59 0-39M0-50Q-12-71 1-80Q13-67 0-50M0-23Q-25-23-25-40Q-6-42 0-23M0-29Q24-26 27-44Q7-46 0-29','#577f58','#3d694b');
    case 'bench':
      return ellipse(0,4,38,11,'#284e431a')+path('M-32-20V-4M9 0V12M32-13V0','none','#3f5b4b','stroke-width="4"')+path('M-35-25L-12-37 36-13 12-1Z','#b58554','#815d3c')+path('M-34-35V-49L13-25V-11Z','#be9563','#815d3c')+path('M-30-42L9-22','none','#876341');
    default: sprite=ellipse(0,-27,20,24,palette.gold);
  }
  if(!pedestal)return `<g>${sprite}</g>`;
  const base=ellipse(0,3,35,12,'#294d4315')+path('M-27-1V-24L0-12V12Z','#b9a783','#9e8d6b')+path('M0-12L27-25V-1L0 12Z','#a79572','#9e8d6b')+path('M-29-26L0-40 29-26 0-12Z','#e9dabb','#cbb994')+path('M8 0L21-6V-1L8 5Z',level>1?'#c5a158':'#ece2c4');
  return base+`<g transform="translate(0 -19)">${sprite}</g>`;
}

export function thumbnail(art, className='') {
  return `<svg class="object-thumbnail ${className}" viewBox="-50 -120 100 145" aria-hidden="true">${objectArt(art)}</svg>`;
}

export const iso=(x,y)=>({x:(x-y)*53,y:(x+y)*27});
export function boardGeometry(s) {
  const {width,height}=dimensions(s);
  const sum=width+height;
  return {width,height,originX:450-(width-height)*26.5,originY:175-(sum-9)*5,viewWidth:900,viewHeight:650+(sum-9)*12};
}
export function tileCenter(s,x,y) {
  const g=boardGeometry(s),p=iso(x+.5,y+.5); return {x:p.x+g.originX,y:p.y+g.originY};
}
function tree(x,y,size=1) {
  return `<g transform="translate(${x} ${y}) scale(${size})">${ellipse(0,6,39,16,'#47705c15')}${path('M-5 0L-4-59H4L6 0Z','#927650')}${ellipse(-18,-53,26,29,'#6b8c64')}${ellipse(18,-61,28,30,'#77966d')}${ellipse(0,-86,31,29,'#87a679')}${path('M-10-97Q5-106 17-95','none','#aec39a','stroke-width="3"')}</g>`;
}
function walls(s) {
  const {width,height}=dimensions(s), a=iso(0,0), b=iso(width,0),c=iso(0,height),h=91;
  let out=path(`M${c.x} ${c.y}L0 0 0 ${-h} ${c.x} ${c.y-h}Z`,'#d6cbb0','#b2ab90')+path(`M0 0L${b.x} ${b.y} ${b.x} ${b.y-h} 0 ${-h}Z`,'#e4d9bd','#b8ae91');
  out+=path(`M${c.x} ${c.y-7}L0-7 ${b.x} ${b.y-7}`,'none','#a6a087','stroke-width="7"');
  for(let y=0;y<height;y++) {
    const p=iso(0,y+.5);
    out+=`<g transform="translate(${p.x} ${p.y-18}) skewY(-27)">${path('M-15-5V-51Q0-66 15-51V-5Z','#efe4c9','#9b967c')}${path('M-11-10V-49Q0-59 11-49V-10Z','#799e91')}${path('M0-57V-9M-11-34H11','none','#dbd6b7','stroke-width="3"')}</g>`;
  }
  for(let x=0;x<width;x++) {
    const p=iso(x+.5,0);
    if(x%2===0) out+=`<g transform="translate(${p.x} ${p.y-40}) skewY(27)">${path('M-14-25H14V8H-14Z','#9b7c4c','#b49b69')}${path('M-10-21H10V4H-10Z','#c3b792')}${path('M-8 0L-1-14 9 0Z','#7b8b6b')}</g>`;
    else out+=`<g transform="translate(${p.x} ${p.y-48})">${ellipse(0,0,26,28,'#ffdf9320')}${path('M0 9V-5','none','#937441')}${path('M-9-5L-5-17H5L9-5Z','#f3dba1','#b99b62')}${ellipse(0,-5,9,3,'#f8eac8')}</g>`;
  }
  return out;
}

export function renderBoard(s,{selected=null,placing=null,compact=typeof matchMedia==='function'&&matchMedia('(max-width: 700px)').matches}={}) {
  const g=boardGeometry(s),door=entrance(s),w=g.width,h=g.height;
  const a=iso(0,0),b=iso(w,0),c=iso(w,h),d=iso(0,h);
  let floor='';
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=iso(x,y),isDoor=x===door.x&&y===door.y;
    const occupied=s.placements.find(v=>v.x===x&&v.y===y);
    const error=placing?placementError(s,placing.id??'_new',x,y):null;
    const available=placing&&!error;
    const label=occupied?BY_ID[occupied.id]?.name??DECOR[occupied.kind]?.name:isDoor?'入口':`空き区画 ${x+1}-${y+1}`;
    const shape=`M${p.x} ${p.y}l53 27-53 27-53-27Z`;
    floor+=`<g class="tile ${available?'available':''} ${occupied?.id===selected?'is-selected':''} ${placing&&error?'blocked':''}" role="button" tabindex="0" aria-label="${esc(label)}" data-tile-x="${x}" data-tile-y="${y}" data-tile-id="${occupied?.id??''}"><path class="floor-tile" d="${shape}" fill="${(x+y)%2?'#c8ac82':'#d1b58b'}" stroke="#b89d77" stroke-width=".7"/>${path(`M${p.x-27} ${p.y+14}l53 27M${p.x-1} ${p.y+1}l-25 39`,'none','#a98b631e')}<path class="tile-highlight" d="${shape}"/>${available?`<g transform="translate(${p.x} ${p.y+27})"><path d="M-7 0H7M0-7V7" stroke="#417e69" stroke-width="2.5"/></g>`:''}<title>${esc(label)}</title></g>`;
  }
  const ordered=[...s.placements].sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x);
  let objects=ordered.map(p=>{
    const pos=iso(p.x+.5,p.y+.5),item=s.collection.find(i=>i.id===p.id);
    const isSelected=selected===p.id;
    const name=BY_ID[p.id]?.name??DECOR[p.kind].name;
    return `<g class="placed-object ${isSelected?'selected-object':''}" data-object="${p.id}" data-action="select" data-id="${p.id}" data-depth="${p.x+p.y+1}" transform="translate(${pos.x} ${pos.y+6})" pointer-events="${placing?'none':'visiblePainted'}" role="button" tabindex="${placing?-1:0}" aria-label="${esc(name)}を選択"><rect x="-35" y="${p.kind==='bench'?-52:p.kind==='plant'?-82:-103}" width="70" height="${p.kind==='bench'?66:p.kind==='plant'?96:117}" fill="transparent"/>${isSelected?ellipse(0,1,39,19,'#e8c67770','stroke="#e9d7a4" stroke-width="2"'):''}${objectArt(p.kind??BY_ID[p.id].art,{level:item?.level})}${item?.level>1?`<g transform="translate(23 -68)"><circle r="9" fill="#315e4e"/><text text-anchor="middle" dominant-baseline="central" fill="#fff2ce" font-size="10">${item.level}</text></g>`:''}</g>`;
  }).join('');
  const entry=iso(door.x+.5,h);
  const cropWidth=(w+h)*53+90;
  const viewBox=compact?`${450-cropWidth/2} 60 ${cropWidth} ${g.viewHeight-140}`:`0 0 ${g.viewWidth} ${g.viewHeight}`;
  return `<svg id="museum-board" viewBox="${viewBox}" aria-label="収集館の見取り図。展示や空き区画を選べます。" role="group">
    <defs><filter id="room-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>
    <ellipse cx="450" cy="${g.originY+(w+h)*15}" rx="${(w+h)*28}" ry="${(w+h)*14}" fill="#56745e0b"/>
    ${tree(162,330,.95)}${tree(725,354,1.05)}${tree(650,188,.62)}${tree(257,179,.65)}
    <g transform="translate(${g.originX} ${g.originY})">
      <ellipse cx="${c.x/2}" cy="${c.y/2+35}" rx="${(w+h)*28}" ry="${(w+h)*13}" fill="#534d3b24" filter="url(#room-shadow)"/>
      ${path(`M${d.x} ${d.y}L${c.x} ${c.y} ${b.x} ${b.y}v19L${c.x} ${c.y+19} ${d.x} ${d.y+19}Z`,'#ad9872','#9a8560')}
      ${floor}${walls(s)}
      ${path(`M${entry.x-25} ${entry.y-10}l51 26-28 14-51-26Z`,'#e6d9b7','#b7a27b')}
      ${path(`M${entry.x-52} ${entry.y+15}l52 26 24-12v8l-24 13-52-26Z`,'#cab992')}
      <g id="visitor-layer">${objects}</g>
      <g transform="translate(${entry.x-80} ${entry.y-8})" pointer-events="none">${path('M0 0V-29M16 8V-21','none','#806f4e','stroke-width="3"')}${path('M-2-31L20-20V-5L-2-16Z','#2f5c4b','#c6aa67')}${path('M3-22L14-17','none','#dfcc96')}</g>
    </g>
  </svg>`;
}

export function visitorArt(index) {
  const colors=['#b67862','#426e72','#887695','#b29a58','#5b7c58','#8b6855'];
  const color=colors[index%colors.length];
  return ellipse(0,2,9,4,'#405a4220')+path('M-3-7L-4 1M3-7L4 1','none','#524b40','stroke-width="3"')+path('M-6-21Q0-25 6-21L7-7H-7Z',color)+`<circle cy="-28" r="6" fill="#dbb58c"/>`+path('M-6-29Q-7-37 1-35Q8-35 6-28L2-31-6-29Z','#60513e');
}
