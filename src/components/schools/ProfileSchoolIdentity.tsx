'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {School,Hash,RefreshCw,ArrowRight} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {schoolsRequest,type SchoolMembership} from '@/lib/schoolsClient';
import {Button} from '@/components/ui/button';
import {Dropdown} from '@/components/ui/dropdown';
import {InlineFeedback} from '@/components/ui/product-motion';

/** Student numbers belong to a school membership, never the shared legacy profile. */
export default function ProfileSchoolIdentity(){
 const{user}=useAuth();
 return user?<SchoolIdentity key={user.id} owner={user.id}/>:null;
}
function SchoolIdentity({owner}:{owner:string}){
 const[members,setMembers]=useState<SchoolMembership[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const version=useRef(0);
 useEffect(()=>{
  const sequence=++version.current;setLoading(true);setError('');
  void schoolsRequest<{items:SchoolMembership[];current_school_id?:string|null}>('memberships','GET',undefined,false,owner).then(value=>{
   if(sequence!==version.current)return;
   if(!Array.isArray(value.items)||value.items.some(member=>member.user_id!==owner||member.school?.id!==member.school_id))throw Error('학교 소속 응답을 확인하지 못했어요. 다시 불러와 주세요.');
   setMembers(value.items);
   setSelected(current=>value.items.some(member=>member.school_id===current)?current:value.items.some(member=>member.school_id===value.current_school_id)?value.current_school_id!:value.items.length===1?value.items[0].school_id:'');
  }).catch(()=>{if(sequence===version.current){setMembers([]);setError('학교와 학번을 불러오지 못했어요. 다시 불러와 주세요.')}}).finally(()=>{if(sequence===version.current)setLoading(false)});
  return()=>{version.current++};
 },[owner,retry]);
 const member=members.find(item=>item.school_id===selected),name=member?.school.display_name||member?.school.official_name;
 return <section className="rounded-xl border bg-card p-5 space-y-4" aria-labelledby="profile-school-title" data-profile-school-identity>
  <div className="flex items-center justify-between gap-3"><h2 id="profile-school-title" className="flex items-center gap-2 text-lg font-bold"><School className="size-5 text-primary"/>학교·학번</h2><Button type="button" variant="ghost" disabled={loading} onClick={()=>setRetry(value=>value+1)} aria-label="학교·학번 다시 불러오기"><RefreshCw className="size-4"/></Button></div>
  <p className="text-sm text-muted-foreground">학번은 학교별로 관리해요. 다른 학교의 학번이나 개인 프로젝트에는 영향을 주지 않아요.</p>
  <InlineFeedback message={error}/>
  {loading?<p role="status" className="text-sm text-muted-foreground">내 학교와 학번을 확인하고 있어요.</p>:error?null:members.length===0?<div className="space-y-3"><p className="text-sm">학교에 가입하면 해당 학교의 학번을 등록할 수 있어요.</p><Button asChild variant="outline"><Link href="/schools">내 학교 찾기<ArrowRight className="size-4"/></Link></Button></div>:<>
   {members.length>1&&<label className="block space-y-2 text-sm font-semibold"><span>학번을 확인할 학교</span><Dropdown value={selected} onChange={event=>setSelected(event.target.value)}><option value="" disabled>학교 선택</option>{members.map(item=><option key={item.school_id} value={item.school_id}>{item.school.display_name||item.school.official_name}</option>)}</Dropdown></label>}
   {member&&<div className="space-y-3 min-w-0"><p className="font-semibold break-words">{name}</p><p className="flex items-start gap-2 text-sm"><Hash className="size-4 shrink-0 mt-0.5 text-primary"/><span className="break-all">{member.student_number||(member.membership_type==='TEACHER'?'교사 소속은 학번 없이 이용할 수 있어요.':'아직 등록된 학번이 없어요.')}</span></p>
    {member.status==='SUSPENDED'?<p className="text-sm text-muted-foreground">학교 소속 이용이 제한돼 있어요. 학교 관리자에게 문의해 주세요.</p>:member.school.status!=='APPROVED'?<p className="text-sm text-muted-foreground">학교 도입 승인이 완료되면 학번을 등록·변경할 수 있어요.</p>:<><p className="text-sm text-muted-foreground">학생 소속과 학번을 입력해 확인을 요청할 수 있어요. 승인 전에는 기존 소속과 학번이 유지돼요.</p><Button asChild variant="outline"><Link href={member.status==='REVERIFICATION_REQUIRED'&&member.school_id==='cbsh'?`/schools/${encodeURIComponent(member.school_id)}/verification`:`/schools/${encodeURIComponent(member.school_id)}/affiliation${member.membership_type==='TEACHER'?'':'?type=STUDENT'}`}>{member.status==='REVERIFICATION_REQUIRED'&&member.school_id==='cbsh'?'새 학번으로 재인증하기':member.membership_type==='TEACHER'?'소속 정보 확인':member.student_number?'학번 변경 요청':'학생 소속·학번 등록'}<ArrowRight className="size-4"/></Link></Button></>}
   </div>}
  </>}
 </section>;
}
