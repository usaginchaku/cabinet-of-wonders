export const THEMES = {
  mechanism: { name: 'からくり', color: '#976439' },
  journey: { name: '旅の記憶', color: '#356c7e' },
  bizarre: { name: '奇妙な遺物', color: '#795982' },
};

export const ARTIFACTS = [
  { id: 'clock', name: '月読みの置時計', theme: 'mechanism', art: 'clock', appeal: 18, repair: 110, days: 1, description: '月と星がゆっくり巡る、小さな天文時計。毎正時の音色が人気。' },
  { id: 'globe', name: '旅人の地球儀', theme: 'journey', art: 'globe', appeal: 16, repair: 100, days: 1, description: 'いくつもの旅路が刻まれた地球儀。まだ知らない場所を指でたどる。' },
  { id: 'musicbox', name: '小さなオルゴール', theme: 'mechanism', art: 'musicbox', appeal: 15, repair: 100, days: 1, description: '蓋を開くと小鳥が回る、木製のオルゴール。時計と並べると音の展示に。' },
  { id: 'mask', name: '石仮面のレプリカ', theme: 'bizarre', art: 'mask', appeal: 26, repair: 180, days: 1, reference: 'ジョジョ 第1部', description: '謎めいた石仮面をかたどった展示用模型。斜めからの光で表情が変わる。' },
  { id: 'train', name: '真鍮のミニ列車', theme: 'mechanism', art: 'train', appeal: 27, repair: 190, days: 2, description: '歯車で走る小さな蒸気機関車。動く部品まで丁寧に磨かれている。' },
  { id: 'tarot', name: '旅路のタロット', theme: 'journey', art: 'tarot', appeal: 24, repair: 160, days: 1, reference: 'ジョジョ 第3部モチーフ', description: '星、太陽、世界。長い旅を思わせるカードを額装したファン創作展示。' },
  { id: 'ruby', name: '赤石の光学模型', theme: 'bizarre', art: 'ruby', appeal: 32, repair: 240, days: 2, reference: 'ジョジョ 第2部・エイジャの赤石モチーフ', description: '赤い石と光の屈折を楽しむ展示。エイジャの赤石に着想を得た模型。' },
  { id: 'radio', name: '杜王町のラジオ', theme: 'journey', art: 'radio', appeal: 30, repair: 210, days: 2, reference: 'ジョジョ 第4部モチーフ', description: '杜王町の午後をイメージした古いラジオ。放送局の小さな展示セット。' },
  { id: 'beetle', name: '黄金のブローチ', theme: 'bizarre', art: 'beetle', appeal: 34, repair: 260, days: 2, reference: 'ジョジョ 第5部モチーフ', description: 'てんとう虫をかたどった金色のブローチ。細工を虫眼鏡でのぞける。' },
  { id: 'orrery', name: '星巡りの天球儀', theme: 'mechanism', art: 'orrery', appeal: 42, repair: 380, days: 3, description: '大小の環が連動する天球儀。工房の技術を集めて、星の動きを取り戻す。' },
  { id: 'colosseum', name: '夕映えのコロッセオ', theme: 'journey', art: 'colosseum', appeal: 42, repair: 360, days: 3, reference: 'ジョジョ 第5部モチーフ', description: '幾重ものアーチを重ねた建築模型。夕暮れのローマを小さな台座の上に。' },
  { id: 'arrow', name: '矢の展示模型', theme: 'bizarre', art: 'arrow', appeal: 46, repair: 430, days: 3, reference: 'ジョジョ 第4〜6部モチーフ', description: '物語の鍵となる矢をモチーフにした展示模型。専用ケースで細部まで鑑賞できる。' },
  { id: 'butterfly', name: '糸と蝶の標本箱', theme: 'bizarre', art: 'butterfly', appeal: 38, repair: 310, days: 2, reference: 'ジョジョ 第6部モチーフ', description: '細い糸で羽の模様を描いた、青緑の蝶。徐倫をイメージしたファン創作作品。' },
  { id: 'automaton', name: '庭師のオートマタ', theme: 'mechanism', art: 'automaton', appeal: 50, repair: 460, days: 3, description: '花に水をやり、一礼する機械人形。手入れを重ねると動きもなめらかに。' },
  { id: 'airship', name: '空飛ぶ船の模型', theme: 'journey', art: 'airship', appeal: 48, repair: 420, days: 3, description: '雲を渡る飛行船の模型。船体の窓には小さな船室が並んでいる。' },
];
export const BY_ID = Object.fromEntries(ARTIFACTS.map(item => [item.id, item]));
export const ROUTES = [
  { id: 'market', name: '古道具市', subtitle: '歯車と真鍮の掘り出し物', theme: 'mechanism', days: 1, cost: 220, items: ['train', 'orrery', 'automaton'], art: 'train' },
  { id: 'port', name: '港町の倉庫', subtitle: '遠い街から届いた記憶', theme: 'journey', days: 2, cost: 280, items: ['tarot', 'radio', 'colosseum', 'airship'], art: 'globe' },
  { id: 'estate', name: '古い屋敷', subtitle: '奇妙な品をたどる調査', theme: 'bizarre', days: 2, cost: 340, items: ['ruby', 'beetle', 'arrow', 'butterfly'], art: 'mask' },
];
export const FACILITIES = {
  workshop: { name: '修復工房', icon: 'hammer', costs: [600, 1200], benefits: ['修復枠 1 → 2', '修復日数 −1日（最短1日）'] },
  lighting: { name: '展示照明', icon: 'lamp', costs: [420, 950], benefits: ['全展示の魅力 +12%', '全展示の魅力 +24%'] },
  room: { name: '展示室を増築', icon: 'expand', costs: [950, 1850, 3200], benefits: ['20区画 → 30区画', '30区画 → 42区画', '42区画 → 56区画'] },
};
export const DECOR = {
  plant: { name: '観葉植物', cost: 110, description: '館内の心地よさ +1', art: 'plant' },
  bench: { name: '休憩ベンチ', cost: 180, description: '受入人数 +3', art: 'bench' },
};
export const AUDIENCES = [
  { name: 'からくり好き', theme: 'mechanism', price: [1.2, 1, .68] },
  { name: '旅好き', theme: 'journey', price: [1.25, 1, .65] },
  { name: '遺物の愛好家', theme: 'bizarre', price: [1.1, 1, .85] },
  { name: '家族連れ', theme: 'mechanism', price: [1.4, 1, .55] },
  { name: '街歩きの人々', theme: 'journey', price: [1.3, 1, .7] },
  { name: '収集家', theme: 'bizarre', price: [1.1, 1, .9] },
];
export const PRICES = [20, 30, 45];
export const DAY_SECONDS = 60;
export const CURATOR = { costs: [900, 650, 1400], wages: [0, 60, 90, 140], experience: [0, 2, 5], benefits: ['開館中の調査・受入 +4人', '調査日数 −1日（最短1日）', '全展示の魅力 +15%'] };
export const SAVE_KEY = 'curio-museum.save.v1';
