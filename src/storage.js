import { SAVE_KEY } from './data.js';
import { initialState, validateSave } from './engine.js';

const MIGRATION_BACKUP_KEY=`${SAVE_KEY}.before-v2`;
export function migrationBackup(storage=localStorage) {
  try {return storage.getItem(MIGRATION_BACKUP_KEY);}catch{return null;}
}

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
    let parsed;try{parsed=JSON.parse(previous);}catch{ /* Recovery preserves the unreadable source until explicitly replaced. */ }
    if(parsed&&validateSave(parsed).ok){
      // Keep the pre-upgrade original even after the rolling backup is replaced.
      if(parsed.version===1&&state.version===2&&!storage.getItem(MIGRATION_BACKUP_KEY))storage.setItem(MIGRATION_BACKUP_KEY,previous);
      storage.setItem(`${SAVE_KEY}.backup`,previous);
    }
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
