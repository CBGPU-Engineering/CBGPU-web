'use client';
import {useCallback,useEffect,useState} from 'react';
import {RefreshCw,Search,Inbox,ChevronDown} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {LoadingSpinner} from '@/components/ui/spinner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
type Application={id:string;created:number;role:string;name:string;email:string;affiliation:string;motivation:string;experience:string;portfolio:string;status:string};
const roles:Record<string,string>={ios:'iOS',product:'Product',frontend:'Frontend',backend:'Backend',android:'Android'};
// 관리자 표(.data-table)와 같은 가장자리 여백(22px)과 열 정렬을 쓴다: 이름 | 소속 | 지원 분야 | 접수 시각 | 상태 | 펼침 아이콘.
// 셸의 `main details>summary{padding:8px 0}`가 레이어 밖이라 일반 유틸리티를 이기므로, 이 행의 여백만 !(important)로 지정한다.
const rowGrid='grid items-center gap-x-6 gap-y-2 px-[22px]! py-4! md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_96px_150px_80px_20px]';
export default function CareersPage(){
 const {isLoading:authLoading,isAdmin}=useAuth();
 const [applications,setApplications]=useState<Application[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState('');
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const response=await fetch('/api/admin/careers',{headers:{Authorization:`Bearer ${session?.access_token||''}`},cache:'no-store',signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'지원서를 불러오지 못했습니다.');
   if(!signal?.aborted)setApplications(data.applications);
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'지원서를 불러오지 못했습니다.');}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{if(authLoading||!isAdmin)return;const abort=new AbortController();void load(abort.signal);return()=>abort.abort();},[authLoading,isAdmin,load]);
 if(authLoading)return <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner label="권한 확인 중"/></div>;
 if(!isAdmin)return <div className="surface p-10 text-center text-sm text-muted-foreground">관리자만 볼 수 있습니다.</div>;
 const filtered=applications.filter(a=>`${a.name} ${a.affiliation} ${a.email} ${a.role}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <h1 className="cb-page-title">Careers 지원서</h1>
   <Button variant="outline" disabled={loading} onClick={()=>void load()} className="gap-2"><RefreshCw className="size-4"/>새로고침</Button>
  </div>
  {/* 모든 박스가 같은 .surface(관리자 셸의 카드 라운드)를 쓰고, 검색줄과 목록을 한 카드로 묶는다. */}
  <div className="surface">
   <div className="table-toolbar" style={{alignItems:'center'}}>
    <div className="flex min-w-0 flex-1 items-center gap-3"><Search className="size-4 shrink-0 text-muted-foreground"/><Input aria-label="지원서 검색" placeholder="이름, 소속, 이메일, 지원 분야 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <span className="shrink-0 text-sm text-muted-foreground">{applications.length}명</span>
   </div>
   {loading?<div className="flex justify-center py-16"><LoadingSpinner label="지원서 불러오는 중"/></div>
   :error?<div role="alert" className="px-[22px] py-6 text-sm text-destructive">{error}</div>
   :!filtered.length?<div className="px-[22px] py-14 text-center text-sm text-muted-foreground"><Inbox className="mx-auto mb-4 size-8"/>{query?'검색 결과가 없습니다.':'접수된 지원서가 없습니다.'}</div>
   :<div className="divide-y divide-border">{filtered.map(a=><details key={a.id} className="group careers-row">
     <summary className={`cursor-pointer list-none transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden ${rowGrid}`}>
      <strong className="truncate text-[15px] font-semibold">{a.name}</strong>
      <span className="truncate text-sm text-muted-foreground">{a.affiliation}</span>
      <span className="inline-flex w-fit items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{roles[a.role]||a.role}</span>
      <time className="text-sm tabular-nums text-muted-foreground">{new Date(a.created*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>
      <span className={`text-sm ${a.status==='received'?'text-success':'text-muted-foreground'}`}>{a.status==='received'?'접수 완료':a.status}</span>
      <ChevronDown aria-hidden="true" className="hidden size-4 text-muted-foreground transition-transform group-open:rotate-180 md:block"/>
     </summary>
     <div className="space-y-5 border-t border-border bg-[var(--dev-background)] px-[22px] py-5">
      <div><p className="mb-2 text-sm font-semibold">이메일</p><a href={`mailto:${a.email}`} className="break-all text-sm text-primary">{a.email}</a></div>
      {[['지원 동기',a.motivation],['경험',a.experience],['포트폴리오',a.portfolio]].map(([label,value])=><div key={label}><h2 className="mb-2 text-sm font-semibold">{label}</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{value||'—'}</p></div>)}
     </div>
    </details>)}</div>}
  </div>
 </section>;
}
