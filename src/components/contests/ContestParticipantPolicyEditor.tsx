'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {useAlert} from '@/lib/alert';
import {Button} from '@/components/ui/button';
import {Dropdown} from '@/components/ui/dropdown';
import {contestParticipantPolicies,contestParticipantPolicyLabels,type ContestParticipantPolicy} from '@/lib/contestSchoolPolicy';
import {changeContestParticipantPolicy,type ObservedContestPolicy} from '@/lib/contestParticipantPolicyUpdate';
import type {Contest} from '@/lib/contests';
export default function ContestParticipantPolicyEditor({contest,onUpdated}:{contest:Contest;onUpdated:(contest:Contest)=>void}){
 const {user}=useAuth();
 if(!user||user.id!==contest.host_id||!contest.school_id||!contest.access_scope||!contest.participant_policy||!contestParticipantPolicies.includes(contest.participant_policy))return null;
 return <Editor key={[contest.id,user.id,contest.school_id,contest.access_scope,contest.participant_policy,JSON.stringify(contest.allowed_school_ids||[])].join(':')} contest={contest as Contest&ObservedContestPolicy} owner={user.id} onUpdated={onUpdated}/>;
}
function Editor({contest,owner,onUpdated}:{contest:Contest&ObservedContestPolicy;owner:string;onUpdated:(contest:Contest)=>void}){
 const [next,setNext]=useState<ContestParticipantPolicy>(contest.participant_policy),[busy,setBusy]=useState(false);const mounted=useRef(true),lock=useRef(false);const {confirm,showError,showSuccess}=useAlert();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 async function save(){
  if(lock.current||next===contest.participant_policy)return;lock.current=true;setBusy(true);
  try{
   const accepted=await confirm({title:'참가 자격을 변경할까요?',message:`${contestParticipantPolicyLabels[next]}로 변경해요. 이미 신청한 사람도 새 자격에 맞지 않으면 제출하거나 투표하지 못할 수 있어요. 신청·제출 기록은 삭제하지 않아요.`,confirmLabel:'자격 변경',cancelLabel:'유지하기'});
   if(!accepted||!mounted.current)return;
   const result=await changeContestParticipantPolicy({...contest,allowed_school_ids:contest.allowed_school_ids||[]},next,owner,()=>mounted.current,{session:async()=>(await supabase.auth.getSession()).data.session,fetch,url:process.env.NEXT_PUBLIC_SUPABASE_URL!,anonKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!});
   if(mounted.current){onUpdated(result as Contest);showSuccess('참가 자격을 변경했어요.')}
  }catch(error){if(mounted.current)showError(error instanceof Error?error.message:'참가 자격을 변경하지 못했어요. 새로고침해 주세요.')}finally{lock.current=false;if(mounted.current)setBusy(false)}
 }
 return <section className="contest-panel space-y-3"><h2 className="text-lg font-semibold">참가 자격</h2><p className="text-sm text-muted-foreground">운영 학교와 참가 학교 범위는 그대로 두고, 참가할 수 있는 계정의 자격만 변경해요.</p><label className="grid gap-2 text-sm"><span>참가 대상</span><Dropdown aria-label="대회 참가 대상 변경" value={next} disabled={busy} onChange={event=>setNext(event.target.value as ContestParticipantPolicy)}>{contestParticipantPolicies.map(value=><option key={value} value={value}>{contestParticipantPolicyLabels[value]}</option>)}</Dropdown></label><Button type="button" className="min-h-11" disabled={busy||next===contest.participant_policy} onClick={()=>void save()}>{busy?'변경 확인 중…':'자격 변경'}</Button></section>;
}
