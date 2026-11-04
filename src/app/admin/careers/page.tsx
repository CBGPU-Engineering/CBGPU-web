'use client';
import {useCallback,useEffect,useState} from 'react';
import {RefreshCw,Search,Inbox} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {LoadingSpinner} from '@/components/ui/spinner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
type Application={id:string;created:number;role:string;name:string;email:string;affiliation:string;motivation:string;experience:string;portfolio:string;status:string};
const roles:Record<string,string>={ios:'iOS',product:'Product',frontend:'Frontend',backend:'Backend',android:'Android'};
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
 if(!isAdmin)return <div className="surface rounded-2xl border p-8 text-center">관리자만 볼 수 있습니다.</div>;
 const filtered=applications.filter(a=>`${a.name} ${a.affiliation} ${a.email} ${a.role}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold tracking-tight">Careers 지원서</h1><Button variant="outline" disabled={loading} onClick={()=>void load()} className="gap-2"><RefreshCw className="size-4"/>새로고침</Button></div>
 <div className="surface rounded-2xl border bg-card p-4 flex items-center gap-3"><Search className="size-4 text-muted-foreground"/><Input aria-label="지원서 검색" placeholder="이름, 소속, 이메일, 지원 분야 검색" value={query} onChange={e=>setQuery(e.target.value)}/><span className="shrink-0 text-sm text-muted-foreground">{applications.length}명</span></div>
 {loading?<div className="py-16 flex justify-center"><LoadingSpinner label="지원서 불러오는 중"/></div>:error?<div role="alert" className="rounded-2xl border border-destructive/30 p-6 text-sm">{error}</div>:!filtered.length?<div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground"><Inbox className="size-8 mx-auto mb-4"/>{query?'검색 결과가 없습니다.':'접수된 지원서가 없습니다.'}</div>:<div className="space-y-3">{filtered.map(a=><details key={a.id} className="rounded-2xl border bg-card overflow-hidden"><summary className="cursor-pointer p-5"><span className="inline-flex flex-wrap items-center gap-x-5 gap-y-2"><strong>{a.name}</strong><span className="text-sm text-muted-foreground">{a.affiliation}</span><span className="rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">{roles[a.role]||a.role}</span><time className="text-xs text-muted-foreground">{new Date(a.created*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time><span className="text-xs text-muted-foreground">{a.status==='received'?'접수 완료':a.status}</span></span></summary><div className="border-t p-5 space-y-5"><div><p className="text-sm font-semibold mb-2">이메일</p><a href={`mailto:${a.email}`} className="text-sm text-primary break-all">{a.email}</a></div>{[['지원 동기',a.motivation],['경험',a.experience],['포트폴리오',a.portfolio]].map(([label,value])=><div key={label}><h2 className="text-sm font-semibold mb-2">{label}</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{value||'—'}</p></div>)}</div></details>)}</div>}</section>;
}
