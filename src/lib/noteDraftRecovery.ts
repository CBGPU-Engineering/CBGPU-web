import type {NoteDraft,ResearchNote} from './notePersistence';
export type NoteRecovery={id:string;owner:string;base:ResearchNote|null;draft:NoteDraft;at:number};
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>|null;
export function noteRecoveryStorage():Store{try{return window.sessionStorage}catch{return null}}
const memory=new Map<string,NoteRecovery>();
const key=(owner:string)=>`cbgpu-note-recovery:${owner}`;
const validDraft=(value:unknown):value is NoteDraft=>{if(!value||typeof value!=='object')return false;const v=value as NoteDraft;return typeof v.title==='string'&&typeof v.content==='string'&&typeof v.is_shared==='boolean'&&Array.isArray(v.tags)&&v.tags.every(tag=>typeof tag==='string')};
/** Tab-scoped, owner-keyed recovery. No tokens, cookies, or server requests. */
export function readNoteRecovery(store:Store,owner:string,now=Date.now()):NoteRecovery|null{
 let value=memory.get(owner);
 if(!value)try{const raw=store?.getItem(key(owner));if(raw)value=JSON.parse(raw) as NoteRecovery}catch{return null}
 if(!value)return null;
 if(value.owner!==owner||typeof value.id!=='string'||!Number.isFinite(value.at)||value.at>now||now-value.at>86400000||!validDraft(value.draft)||value.base&&(value.base.id!==value.id||value.base.user_id!==owner||!validDraft(value.base)||typeof value.base.updated_at!=='string')){
  memory.delete(owner);try{store?.removeItem(key(owner))}catch{/* Storage may be blocked. */}return null;
 }
 return value;
}
export function writeNoteRecovery(store:Store,input:NoteRecovery|Omit<NoteRecovery,'at'>):boolean{
 const value:NoteRecovery={...input,at:'at'in input?input.at:Date.now()};memory.set(value.owner,value);
 try{if(!store)return false;store.setItem(key(value.owner),JSON.stringify(value));return true}catch{return false}
}
export function clearNoteRecovery(store:Store,owner:string,id:string){
 if(readNoteRecovery(store,owner)?.id!==id)return;
 memory.delete(owner);try{store?.removeItem(key(owner))}catch{/* Storage may be blocked. */}
}
