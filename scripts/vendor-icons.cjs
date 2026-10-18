const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = process.argv[2];
if (!pkg) throw new Error('Pass the absolute path to an installed lucide package.');
const lucide = require(pkg);
const names = { museum:'Landmark', collection:'Boxes', hammer:'Hammer', compass:'Compass', info:'Info', close:'X', coin:'Coins', star:'Star', people:'Users', arrow:'ArrowRight', chevron:'ChevronRight', check:'Check', plus:'Plus', minus:'Minus', expand:'Expand', lamp:'LampDesk', plant:'Sprout', bench:'Armchair', move:'Move', store:'Archive', play:'Play', fast:'FastForward', download:'Download', upload:'Upload', settings:'Settings2', book:'BookOpen', sound:'Volume2', muted:'VolumeX', reset:'RotateCcw', clock:'Clock3', lock:'LockKeyhole', sparkle:'Sparkles', route:'Route', save:'CircleCheck', alert:'CircleAlert', price:'Ticket', leaf:'Leaf', home:'House', eye:'Eye', flag:'Flag', wrench:'Wrench', pause:'Pause', list:'List', trophy:'Award' };
const icons = Object.fromEntries(Object.entries(names).map(([key,name]) => {
  if (!lucide[name]) throw new Error(`Missing icon ${name}`);
  return [key,lucide[name]];
}));
fs.writeFileSync(path.join(root,'src','icons.js'), '// Lucide icons, ISC license. Vendored subset, see assets/LUCIDE-LICENSE.\nexport const ICONS = '+JSON.stringify(icons)+';\n');
fs.copyFileSync(path.join(pkg,'LICENSE'),path.join(root,'assets','LUCIDE-LICENSE'));
