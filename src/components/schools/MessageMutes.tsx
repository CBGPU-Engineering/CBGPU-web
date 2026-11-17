'use client';
import{useEffect,useState}from'react';
import{schoolsRequest}from'@/lib/schoolsClient';
import{Button}from'@/components/ui/button';
import{InlineFeedback}from'@/components/ui/product-motion';
type Muted={user_id:string;sender_label:string};
export default function MessageMutes({userId}:{userId:string}){
 const[open,setOpen]=useState(false),[items,setItems]=useState<Muted[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{if(!open)return;let live=true;setBusy(true);void schoolsRequest<{items:Muted[]}>('message-mutes','GET',undefined,false,userId).then(value=>{if(live){setItems(value.items);setError('')}}).catch(e=>{if(live){setItems([]);setError(e instanceof Error?e.message:'숨긴 참여자를 확인하지 못했어요.')}}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[open,userId,version]);
 async function restore(id:string){if(busy)return;setBusy(true);setError('');try{await schoolsRequest('message-mutes','POST',{muted_user_id:id,muted:false},false,userId);setItems(old=>old.filter(item=>item.user_id!==id));window.dispatchEvent(new Event('cbgpu-message-mutes-changed'))}catch(e){setError(e instanceof Error?e.message:'숨기기를 해제하지 못했어요.')}finally{setBusy(false)}}
 return <details className="cb-school-page" onToggle={e=>setOpen(e.currentTarget.open)}><summary>숨긴 참여자 관리</summary><p className="cb-school-help">숨긴 참여자의 메시지와 새 개인 대화 연결을 제한해요. 해제해도 메시지가 자동 전송되지는 않아요.</p><InlineFeedback message={error}/>{busy&&<p role="status">목록을 확인하고 있어요.</p>}{!busy&&!items.length&&!error&&<p>숨긴 참여자가 없어요.</p>}<ul>{items.map(item=><li key={item.user_id}>{item.sender_label?.trim().slice(0,80)||'참여자'} <Button type="button" variant="outline" disabled={busy} onClick={()=>void restore(item.user_id)}>숨기기 해제</Button></li>)}</ul><Button type="button" variant="ghost" disabled={busy} onClick={()=>setVersion(value=>value+1)}>숨긴 참여자 새로고침</Button></details>
}
