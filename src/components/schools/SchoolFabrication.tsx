'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {InlineFeedback} from '@/components/ui/product-motion';
import ConfirmDialog from '@/components/ConfirmDialog';

type Person={user_id:string;full_name:string|null;student_number:string|null};
type Printer={id:number;name:string;managers:Person[]};
type Overview={printers:Printer[];laser_managers:Person[]};
type Removal={kind:'print'|'laser';printer?:Printer;person:Person}|{kind:'printer';printer:Printer};

const errors:Record<string,string>={
 SCHOOL_ADMIN_REQUIRED:'이 학교의 관리자 권한이 필요해요.',
 FABRICATION_NOT_ENABLED:'이 학교에서 제작 기능이 켜져 있지 않아요. 학교 설정에서 먼저 켜 주세요.',
 ACTIVE_SCHOOL_MEMBER_REQUIRED:'이 학교의 인증된 학생·교사만 담당자로 지정할 수 있어요.',
 PRINTER_IN_USE:'작업 기록이 있는 프린터는 삭제할 수 없어요. 이름만 바꿔 주세요.',
 PRINTER_LIMIT:'프린터는 학교당 20대까지 등록할 수 있어요.',
 INVALID_PRINTER_NAME:'프린터 이름은 1~40자로 입력해 주세요.',
 PRINTER_NOT_FOUND:'프린터를 찾지 못했어요. 새로고침해 주세요.'
};
const label=(p:Person)=>(p.full_name||'이름 없음')+(p.student_number?' · '+p.student_number:'');

export default function SchoolFabrication({schoolId}:{schoolId:string}){
 const {user}=useAuth();
 return user?<Panel key={schoolId+':'+user.id} schoolId={schoolId} owner={user.id}/>:null;
}

function Panel({schoolId,owner}:{schoolId:string;owner:string}){
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[newName,setNewName]=useState(''),[removal,setRemoval]=useState<Removal|null>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);

 // Every call is pinned to the account that opened this screen.
 const call=useCallback(async<T,>(action:string,payload:Record<string,unknown>={}):Promise<T>=>{
  const session=(await supabase.auth.getSession()).data.session;
  if(!session||session.user.id!==owner)throw Error('계정이 바뀌었어요. 화면을 다시 열어 주세요.');
  const {data:result,error:failure}=await supabase.rpc('cbgpu_school_fabrication',{p_action:action,p_payload:{school_id:schoolId,...payload}}).setHeader('Authorization','Bearer '+session.access_token);
  if(failure)throw Error(errors[failure.message]||'요청을 처리하지 못했어요. 권한을 확인한 뒤 다시 시도해 주세요.');
  return result as T;
 },[owner,schoolId]);

 const load=useCallback(async()=>{
  try{const result=await call<Overview>('overview');if(alive.current){setData(result);setError('')}}
  catch(e){if(alive.current){setData(null);setError(e instanceof Error?e.message:'불러오지 못했어요.')}}
 },[call]);
 useEffect(()=>{void load()},[load]);

 async function run(action:string,payload:Record<string,unknown>,done:string){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{await call(action,payload);if(!alive.current)return;setNotice(done);await load()}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'요청을 처리하지 못했어요.')}
  finally{if(alive.current)setBusy(false)}
 }

 return <section className="cb-school-step-body">
  <h2>제작 담당자</h2>
  <p className="cb-school-help">3D 프린터는 프린터마다, 레이저 커팅기는 학교 전체로 담당자를 정해요. 이 학교의 인증된 학생·교사만 지정할 수 있고, 다른 학교에는 영향이 없어요.</p>
  <InlineFeedback message={error}/><InlineFeedback kind="success" message={notice}/>
  {!data&&!error&&<p role="status">불러오는 중…</p>}
  {data&&<>
   <h3>3D 프린터</h3>
   <form className="cb-school-member-search" onSubmit={e=>{e.preventDefault();const name=newName.trim();if(name)void run('printer_add',{name},'프린터를 추가했어요.').then(()=>setNewName(''))}}>
    <label className="sr-only" htmlFor="school-printer-name">새 프린터 이름</label>
    <Input id="school-printer-name" value={newName} maxLength={40} onChange={e=>setNewName(e.target.value)} placeholder="새 프린터 이름 (예: 프린터 5)"/>
    <Button type="submit" disabled={busy||!newName.trim()}>프린터 추가</Button>
   </form>
   {!data.printers.length&&<p>등록된 프린터가 없어요. 위에서 먼저 프린터를 추가해 주세요.</p>}
   <ul className="cb-school-member-list">{data.printers.map(printer=><li key={printer.id}>
    <div><strong>{printer.name}</strong><small>{printer.managers.length?printer.managers.map(label).join(', '):'담당자 없음'}</small></div>
    <div className="flex flex-wrap gap-2">
     {printer.managers.map(person=><Button key={person.user_id} type="button" variant="outline" disabled={busy} onClick={()=>setRemoval({kind:'print',printer,person})}>{(person.full_name||'담당자')+' 해제'}</Button>)}
     <Picker disabled={busy} exclude={printer.managers} call={call} onPick={person=>void run('manager_add',{kind:'print',printer_id:printer.id,user_id:person.user_id},'담당자를 지정했어요.')}/>
     <RenameButton printer={printer} disabled={busy} onRename={name=>void run('printer_rename',{printer_id:printer.id,name},'프린터 이름을 바꿨어요.')}/>
     <Button type="button" variant="outline" disabled={busy} onClick={()=>setRemoval({kind:'printer',printer})}>프린터 삭제</Button>
    </div>
   </li>)}</ul>
   <h3>레이저 커팅기</h3>
   <ul className="cb-school-member-list">{data.laser_managers.map(person=><li key={person.user_id}><div><strong>{label(person)}</strong></div><Button type="button" variant="outline" disabled={busy} onClick={()=>setRemoval({kind:'laser',person})}>담당 해제</Button></li>)}</ul>
   {!data.laser_managers.length&&<p>지정된 레이저 담당자가 없어요.</p>}
   <Picker disabled={busy} exclude={data.laser_managers} call={call} label="레이저 담당자 추가" onPick={person=>void run('manager_add',{kind:'laser',user_id:person.user_id},'레이저 담당자를 지정했어요.')}/>
  </>}
  <ConfirmDialog open={!!removal} title={removal?.kind==='printer'?'프린터를 삭제할까요?':'담당자를 해제할까요?'}
   description={removal?.kind==='printer'?`${removal.printer.name}과(와) 이 프린터의 담당자 지정이 삭제돼요. 작업 기록이 있으면 삭제되지 않아요.`:removal?`${label(removal.person)} 님의 ${removal.kind==='print'?removal.printer?.name+' 담당':'레이저 담당'} 권한이 해제돼요.`:''}
   cancelLabel="취소" confirmLabel={removal?.kind==='printer'?'프린터 삭제':'담당 해제'}
   onCancel={()=>{if(!busy)setRemoval(null)}}
   onConfirm={()=>{const r=removal;setRemoval(null);if(!r)return;void(r.kind==='printer'?run('printer_remove',{printer_id:r.printer.id},'프린터를 삭제했어요.'):run('manager_remove',{kind:r.kind,printer_id:r.printer?.id,user_id:r.person.user_id},'담당자를 해제했어요.'))}}/>
 </section>;
}

function RenameButton({printer,disabled,onRename}:{printer:Printer;disabled:boolean;onRename:(name:string)=>void}){
 const [open,setOpen]=useState(false),[name,setName]=useState(printer.name);
 if(!open)return <Button type="button" variant="outline" disabled={disabled} onClick={()=>{setName(printer.name);setOpen(true)}}>이름 변경</Button>;
 return <form className="flex gap-2" onSubmit={e=>{e.preventDefault();const next=name.trim();if(next&&next!==printer.name)onRename(next);setOpen(false)}}>
  <Input aria-label="프린터 이름" value={name} maxLength={40} onChange={e=>setName(e.target.value)}/><Button type="submit" disabled={disabled}>저장</Button><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>취소</Button>
 </form>;
}

function Picker({disabled,exclude,call,onPick,label:text='담당자 추가'}:{disabled:boolean;exclude:Person[];call:<T,>(action:string,payload?:Record<string,unknown>)=>Promise<T>;onPick:(person:Person)=>void;label?:string}){
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[items,setItems]=useState<Person[]>([]),[failed,setFailed]=useState(false);
 const search=useCallback(async(query:string)=>{
  try{const result=await call<{items:Person[]}>('candidates',{q:query});setItems(result.items);setFailed(false)}catch{setItems([]);setFailed(true)}
 },[call]);
 useEffect(()=>{if(!open)return;const timer=setTimeout(()=>void search(q),250);return()=>clearTimeout(timer)},[open,q,search]);
 if(!open)return <Button type="button" variant="outline" disabled={disabled} onClick={()=>setOpen(true)}>{text}</Button>;
 const taken=new Set(exclude.map(p=>p.user_id));
 return <div className="cb-school-picker-inline">
  <Input aria-label="이름 또는 학번 검색" value={q} maxLength={40} onChange={e=>setQ(e.target.value)} placeholder="이름 또는 학번 검색"/>
  {failed&&<p role="alert">검색하지 못했어요.</p>}
  <ul>{items.filter(p=>!taken.has(p.user_id)).map(p=><li key={p.user_id}><span>{label(p)}</span> <Button type="button" disabled={disabled} onClick={()=>{setOpen(false);setQ('');onPick(p)}}>지정</Button></li>)}</ul>
  <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>닫기</Button>
 </div>;
}
