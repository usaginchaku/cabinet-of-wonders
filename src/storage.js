import { SAVE_KEY } from './data.js';
import { initialState, validateSave } from './engine.js';

export function loadGame(storage=localStorage) {
  try {
    const raw=storage.getItem(SAVE_KEY);
    if(!raw)return {state:initialState(),fresh:true};
    const checked=validateSave(JSON.parse(raw));
    if(!checked.ok)throw new Error(checked.error);
    return {state:checked.state,fresh:false};
  } catch(error) {
    return {state:initialState(),error:`セーブを読み込めませんでした。元のデータは保持しています。${error.message}`};
  }
}
export function saveGame(state,storage=localStorage) {
  const previous=storage.getItem(SAVE_KEY);
  if(previous) {
    try { if(validateSave(JSON.parse(previous)).ok)storage.setItem(`${SAVE_KEY}.backup`,previous); } catch { /* Preserve unreadable data under the primary key until explicit recovery. */ }
  }
  storage.setItem(SAVE_KEY,JSON.stringify(state));
}
export function parseImport(text) {
  if(text.length>250000)return {ok:false,error:'セーブファイルが大きすぎます。'};
  try {return validateSave(JSON.parse(text));}catch{return {ok:false,error:'JSON形式のセーブファイルを選んでください。'};}
}
export function downloadSave(state,filename='奇妙な収集館-save.json') {
  const content=typeof state==='string'?state:JSON.stringify(state,null,2);
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a'); link.href=url; link.download=filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
