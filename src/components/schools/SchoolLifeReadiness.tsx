'use client';
import{useState}from'react';
import Link from'next/link';
import{useAuth}from'@/lib/useAuth';
import{selectAccountSchool}from'@/lib/schoolsClient';
import{schoolLifeReadiness}from'@/lib/schoolLifeReadiness';
import type{SchoolLifeSources}from'@/lib/schoolLifeSettings';
import{isNativeAppHint}from'@/lib/nativeBridge';
import{Button}from'@/components/ui/button';
import{useSchoolScope}from'./SchoolScope';
export default function SchoolLifeReadiness({source}:{source:SchoolLifeSources}){
 const{user}=useAuth(),scope=useSchoolScope(),[busy,setBusy]=useState(false),[error,setError]=useState(''),readiness=schoolLifeReadiness(source);
 const member=scope.memberships.some(m=>m.school_id===source.school_id&&m.verified&&m.status==='ACTIVE'&&m.school.status==='APPROVED');
 async function open(path:'/meal'|'/timetable'){if(!user||busy||!member)return;setBusy(true);setError('');try{const selected=await selectAccountSchool(source.school_id,user.id);window.dispatchEvent(new CustomEvent('cbgpu-school-changed',{detail:{school_id:selected}}));const target=new URL(path,location.origin);if(isNativeAppHint())target.searchParams.set('native','1');window.location.assign(target.pathname+target.search)}catch{setError('학교 선택이나 현재 소속을 확인하지 못했어요. 계정과 기존 작업은 유지돼요. 다시 확인해 주세요.');setBusy(false)}}
 return <section className="space-y-3" aria-label="학교 연동 다음 단계"><h3 className="font-semibold">연동 후 무엇을 할 수 있나요?</h3><p className="text-sm text-muted-foreground">설정만으로 실제 연결에 성공한 것은 아니에요. 소속 확인을 마친 구성원이 이 학교를 선택하고 시간표·급식의 현재 응답을 확인할 수 있어요.</p>{error&&<p role="alert">{error}</p>}<div className="grid gap-3 sm:grid-cols-2">{([{key:'meal',label:'급식',path:'/meal'},{key:'timetable',label:'시간표',path:'/timetable'}]as const).map(item=>{const state=readiness[item.key];const title=state.state==='DISABLED'?'학교생활 기능 꺼짐':state.state==='CATALOG_LINKED'?'나이스 학교 정보 연결':state.state==='CONFIGURED'?'검토한 연결 설정됨':state.state==='EXACT_LOOKUP_REQUIRED'?'정확한 학교명·지역 조회 필요':'연결 미설정';const detail=state.state==='DISABLED'?'학교 설정에서 학교생활 기능을 먼저 켜 주세요.':state.state==='CATALOG_LINKED'?'공식 학교·교육청 코드로 급식을 조회해요. 휴일에는 식단이 없을 수 있으며 실제 응답은 화면을 열 때 확인해요.':state.state==='CONFIGURED'?'이 학교의 검토된 정보 출처를 사용해요. 화면을 열어 현재 제공 정보를 확인해 주세요.':state.state==='EXACT_LOOKUP_REQUIRED'?'공식 학교명과 지역이 정확히 하나 일치할 때만 사용해요. 일치하지 않으면 운영진에게 연결 검토를 요청해 주세요.':'이 학교의 연동 검토를 요청해 주세요. 다른 학교의 정보를 대신 사용하지 않아요.';return <article key={item.key} className="rounded-xl border p-4 space-y-2"><h4>{item.label}: {title}</h4><p className="text-sm">{detail}</p>{state.canOpen&&member?<Button type="button" variant="outline" disabled={busy} onClick={()=>void open(item.path)}>{busy?'학교 선택 중…':'이 학교 선택 후 '+item.label+' 열기'}</Button>:state.canOpen?<p className="text-sm">이 기능을 열려면 이 학교의 소속 확인이 필요해요.</p>:state.state==='DISABLED'?<Button asChild variant="outline"><Link href={'/schools/'+encodeURIComponent(source.school_id)+'/admin?section=features'}>학교 설정 열기</Link></Button>:<Button asChild variant="outline"><Link href={'/schools/'+encodeURIComponent(source.school_id)+'/features'}>연동 검토 요청</Link></Button>}</article>})}</div></section>
}
