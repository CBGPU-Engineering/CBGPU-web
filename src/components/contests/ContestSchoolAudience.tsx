'use client';
import {useEffect,useState} from 'react';
import {useSchoolScope} from '@/components/schools/SchoolScope';
import {schoolsRequest,type SchoolSummary} from '@/lib/schoolsClient';
import {contestParticipantPolicies,contestParticipantPolicyLabels,type ContestSchoolPolicy} from '@/lib/contestSchoolPolicy';
import {Input} from '@/components/ui/input';
import {Dropdown} from '@/components/ui/dropdown';

export default function ContestSchoolAudience({value,onChange}:{value:ContestSchoolPolicy;onChange:(value:ContestSchoolPolicy)=>void}){
 const scope=useSchoolScope();
 const [query,setQuery]=useState(''),[items,setItems]=useState<SchoolSummary[]>([]),[selected,setSelected]=useState<SchoolSummary[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let active=true;setItems([]);setError('');if(value.access_scope!=='MULTI_SCHOOL'||!query.trim()){setLoading(false);return;}setLoading(true);const timer=setTimeout(()=>{void schoolsRequest<{items:SchoolSummary[]}>('schools?q='+encodeURIComponent(query.trim())+'&limit=30','GET',undefined,true).then(result=>{if(active)setItems(result.items.filter(s=>s.status==='APPROVED'&&s.id!==value.school_id))}).catch(()=>{if(active)setError('학교를 검색하지 못했어요. 검색어를 다시 입력해 주세요.')}).finally(()=>{if(active)setLoading(false)})},250);return()=>{active=false;clearTimeout(timer)}},[query,value.access_scope,value.school_id]);
 return <section className="contest-panel space-y-4" aria-label="대회 운영 학교와 참가 범위">
  <div><h2 className="font-bold">운영 학교와 참가 대상</h2><p className="mt-1 text-sm text-muted-foreground">운영 학교: {scope.school?.display_name||'학교를 먼저 선택해 주세요'}. 참가 학교를 추가해도 학교 관리 권한은 공유되지 않아요.</p></div>
  <label className="block space-y-2 text-sm"><span>참가 범위</span><Dropdown aria-label="참가 범위" value={value.access_scope} onChange={event=>{onChange({...value,access_scope:event.target.value as ContestSchoolPolicy['access_scope'],allowed_school_ids:[]});setSelected([]);setQuery('')}}><option value="SCHOOL">우리 학교 구성원</option><option value="MULTI_SCHOOL">선택한 학교</option><option value="PUBLIC">학교 제한 없음</option></Dropdown></label>
  {value.access_scope==='MULTI_SCHOOL'&&<div className="space-y-2"><label className="block text-sm" htmlFor="contest-school-search">참가 학교 찾기</label><Input id="contest-school-search" value={query} maxLength={150} onChange={event=>setQuery(event.target.value)} placeholder="학교 이름으로 검색"/><p className="text-sm text-muted-foreground">CBGPU 이용 승인을 받은 학교를 추가하세요. 운영 학교는 기본으로 포함돼요.</p><div aria-live="polite" className="text-sm">{loading?'학교 검색 중…':error||(query.trim()&&!items.length?'선택할 수 있는 학교가 없어요.':null)}</div><ul className="space-y-1">{items.filter(s=>!value.allowed_school_ids.includes(s.id)).map(s=><li key={s.id}><button type="button" className="min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted" onClick={()=>{onChange({...value,allowed_school_ids:[...value.allowed_school_ids,s.id]});setSelected(old=>[...old.filter(item=>item.id!==s.id),s])}}>{s.display_name} · {s.region} 추가</button></li>)}</ul><ul className="flex flex-wrap gap-2">{selected.filter(s=>value.allowed_school_ids.includes(s.id)).map(s=><li key={s.id}><button type="button" className="min-h-11 rounded-lg border px-3 text-sm" aria-label={s.display_name+' 참가 학교에서 제외'} onClick={()=>onChange({...value,allowed_school_ids:value.allowed_school_ids.filter(id=>id!==s.id)})}>{s.display_name} ×</button></li>)}</ul></div>}
  <label className="block space-y-2 text-sm"><span>참가 자격</span><Dropdown aria-label="참가 자격" value={value.participant_policy} onChange={event=>onChange({...value,participant_policy:event.target.value as ContestSchoolPolicy['participant_policy']})}>{contestParticipantPolicies.map(policy=><option key={policy} value={policy}>{contestParticipantPolicyLabels[policy]}</option>)}</Dropdown></label>
  <p className="text-sm leading-relaxed text-muted-foreground">학교 범위와 참가 자격을 모두 충족해야 참가할 수 있어요. 신청·제출·투표할 때 현재 자격을 확인해요. 대회를 목록에 표시할지는 아래에서 따로 정해요.</p>
 </section>
}
