/** Ordered, owner-bound note writes. A failed write is reconciled by ID before an explicit retry. */
export type NoteDraft={title:string;content:string;tags:string[];is_shared:boolean};
export type ResearchNote=NoteDraft&{id:string;user_id:string;created_at:string;updated_at:string};
export class NoteConflict extends Error{constructor(){super('다른 기기에서 노트가 바뀌었어요. 입력 내용을 복사한 뒤 목록에서 다시 열어 주세요.')}}
const same=(row:NoteDraft,draft:NoteDraft)=>row.title===(draft.title||'제목 없음')&&row.content===draft.content&&row.is_shared===draft.is_shared&&JSON.stringify(row.tags)===JSON.stringify(draft.tags);
export function createNotePersistence(options:{id:string;owner:string;initial:ResearchNote|null;recoveredDraft?:NoteDraft;read:()=>Promise<ResearchNote|null>;create:(draft:NoteDraft)=>Promise<ResearchNote>;update:(draft:NoteDraft,version:string)=>Promise<ResearchNote|null>}){
 let saved=options.initial,uncertain:NoteDraft|null=options.recoveredDraft??null;
 return async(draft:NoteDraft)=>{
  const snapshot={...draft,title:draft.title||'제목 없음',tags:[...draft.tags]};
  if(uncertain){
   const found=await options.read();
   if(found&&same(found,uncertain))saved=found;
   else if(saved?found?.updated_at!==saved.updated_at:found!==null)throw new NoteConflict();
   uncertain=null;
  }
  if(saved&&same(saved,snapshot))return saved;
  let row:ResearchNote|null;
  try{row=saved?await options.update(snapshot,saved.updated_at):await options.create(snapshot)}catch(error){uncertain=snapshot;throw error}
  if(!row)throw new NoteConflict();
  if(row.id!==options.id||row.user_id!==options.owner){uncertain=snapshot;throw Error('노트 저장 결과를 확인하지 못했어요.')}
  saved=row;return row;
 };
}
/** Coalesce queued snapshots, never overlap writes or retry failed mutations automatically. */
export function createSerializedWriter<T,R>(persist:(value:T)=>Promise<R>){
 type Job={value:T;waiters:{resolve:(result:R)=>void;reject:(error:unknown)=>void}[]};
 let pending:Job|null=null,running=false;
 const cancel=(error:unknown=new Error('저장을 취소했어요.'))=>{const job=pending;pending=null;job?.waiters.forEach(w=>w.reject(error))};
 const pump=async()=>{
  if(running)return;running=true;
  try{while(pending){const job=pending;pending=null;try{const result=await persist(job.value);job.waiters.forEach(w=>w.resolve(result))}catch(error){job.waiters.forEach(w=>w.reject(error));cancel(error);break}}}finally{running=false}
 };
 return{save(value:T):Promise<R>{return new Promise((resolve,reject)=>{if(pending){pending.value=value;pending.waiters.push({resolve,reject})}else pending={value,waiters:[{resolve,reject}]};void pump()})},cancelPending:cancel};
}
