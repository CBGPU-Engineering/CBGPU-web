'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {Check,Clock,Cpu,ExternalLink,UserPlus,X,ArrowLeft,Loader2,Activity,Trash2,HelpCircle,RefreshCw} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/lib/useAuth';
import {siteHref} from '@/lib/siteHref';
import {LoadingSpinner} from '@/components/ui/spinner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dropdown} from '@/components/ui/dropdown';
import {filterAdminGpuReservations,matchesAdminGpuView,adminGpuHistoryBefore,type AdminGpuView} from '@/lib/adminGpuReservations';
import ConfirmDialog from '@/components/ConfirmDialog';
/**
 * 앱(폰) 전용 관리 화면. 데이터·권한은 기존 관리자 화면과 같다(같은 Supabase 쿼리와 RLS, 같은 /api/admin/profiles).
 * admin.cbgpu.com 안에 있으므로 별도 인증 경계는 그대로이고, 표 대신 카드 + 하단 네비게이션으로 보여 준다.
 */
type Tab='home'|'signups'|'gpu'|'more';
const tabs:{id:Tab;label:string}[]=[{id:'home',label:'요약'},{id:'signups',label:'가입 승인'},{id:'gpu',label:'GPU 예약'},{id:'more',label:'더보기'}];
type StudyHealth={state:'ok'|'warning'|'critical'|'unknown';label:string;detail:string;minutesAgo:number|null;hoursLeft:number|null;rooms:number|null};
const healthTone={ok:'text-emerald-500',warning:'text-amber-500',critical:'text-destructive',unknown:'text-muted-foreground'} as const;
const leftText=(h:number|null)=>h===null?'':h<=0?'만료됨':h<24?`${Math.max(1,Math.round(h))}시간`:`${Math.floor(h/24)}일 ${Math.round(h%24)}시간`;
const fmt=(v:string)=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시간 정보 없음';
const gpuViews:{id:AdminGpuView;label:string}[]=[{id:'all',label:'전체'},{id:'pending',label:'승인 대기'},{id:'approved',label:'승인'},{id:'active',label:'사용 중'},{id:'upcoming',label:'시작 전'},{id:'ended',label:'종료'},{id:'rejected',label:'거절'}];
const statusLabel=(status:string)=>status==='pending'?'승인 대기':status==='approved'?'승인됨':status==='rejected'?'거절됨':'상태 확인 필요';
export default function MobileAdminPage(){
 const {user,isLoading:authLoading,isAdmin}=useAuth();
 const router=useRouter(),params=useSearchParams();
 const param=params.get('tab') as Tab|null;
 const tab:Tab=param&&tabs.some(t=>t.id===param)?param:'home';
 const [profiles,setProfiles]=useState<any[]>([]),[reservations,setReservations]=useState<any[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busyKey,setBusyKey]=useState('');
 const [study,setStudy]=useState<StudyHealth|null>(null);
 const [deleteTarget,setDeleteTarget]=useState<{id:string;name:string}|null>(null);
 const [gpuView,setGpuView]=useState<AdminGpuView>('all'),[gpuQuery,setGpuQuery]=useState(''),[gpuFilter,setGpuFilter]=useState('all'),[visibleGpu,setVisibleGpu]=useState(30),[now,setNow]=useState(Date.now()),[loadedAt,setLoadedAt]=useState<string|null>(null);
 const reading=useRef<{owner:string;ticket:number}|null>(null),generation=useRef(0),actor=useRef(user?.id);actor.current=user?.id;
 const [gpuHasMore,setGpuHasMore]=useState(false),[loadingOlder,setLoadingOlder]=useState(false),olderReading=useRef<{owner:string;ticket:number}|null>(null);
 const go=(next:Tab)=>router.replace(`/admin/m${next==='home'?'':`?tab=${next}`}`);
 const load=useCallback(async()=>{
  const owner=user?.id;if(!owner||reading.current?.owner===owner&&reading.current.ticket===generation.current)return;const ticket=++generation.current;reading.current={owner,ticket};
  setLoading(true);setLoadingOlder(false);setError('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(ticket!==generation.current||actor.current!==owner)return;
   if(!owner||session?.user.id!==owner)throw Error('로그인 상태를 다시 확인해 주세요.');
   const [p,r]=await Promise.all([
    fetch('/api/admin/profiles',{headers:{Authorization:`Bearer ${session?.access_token||''}`},cache:'no-store'}).then(async x=>{const j=await x.json();if(!x.ok)throw new Error(j.error||'계정을 불러오지 못했습니다.');return j.profiles||[]}),
    supabase.from('reservations').select('*, profiles:user_id (full_name, student_id)').order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(300).then(({data,error})=>{if(error)throw new Error('GPU 예약을 불러오지 못했습니다.');return data||[]}),
   ]);
   const currentSession=(await supabase.auth.getSession()).data.session;
   if(ticket!==generation.current||actor.current!==owner||currentSession?.user.id!==owner)return;
   setProfiles(p);setReservations(r);setGpuHasMore(r.length===300);setLoadedAt(new Date().toISOString());setNow(Date.now());
   try{const res=await fetch('/api/admin/health',{headers:{Authorization:`Bearer ${session?.access_token||''}`},cache:'no-store'});const next=res.ok?(await res.json()).study:null;if(ticket===generation.current&&actor.current===owner)setStudy(next)}catch{if(ticket===generation.current&&actor.current===owner)setStudy(null)}
  }catch(e){if(ticket===generation.current&&actor.current===owner)setError(e instanceof Error?e.message:'불러오지 못했습니다.')}
  finally{if(reading.current?.ticket===ticket)reading.current=null;if(ticket===generation.current)setLoading(false)}
 },[user?.id]);
 useEffect(()=>{setProfiles([]);setReservations([]);setStudy(null);setLoadedAt(null);setGpuHasMore(false);setLoadingOlder(false);setGpuView('all');setGpuQuery('');setGpuFilter('all');return()=>{generation.current++}},[user?.id]);
 useEffect(()=>{if(!authLoading&&isAdmin)void load()},[authLoading,isAdmin,load]);
 useEffect(()=>{setVisibleGpu(30)},[gpuView,gpuQuery,gpuFilter]);
 useEffect(()=>{if(tab!=='gpu')return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[tab]);
 async function loadOlder(){
  const owner=user?.id,ticket=generation.current;
  if(!owner||loading||!gpuHasMore||olderReading.current?.owner===owner&&olderReading.current.ticket===ticket)return;
  const current={owner,ticket};olderReading.current=current;setLoadingOlder(true);setError('');
  try{
   const initialSession=(await supabase.auth.getSession()).data.session;
   if(ticket!==generation.current||actor.current!==owner)return;
   if(initialSession?.user.id!==owner)throw Error('로그인 상태를 다시 확인해 주세요.');
   const cursor=adminGpuHistoryBefore(reservations[reservations.length-1]);
   const {data,error}=await supabase.from('reservations').select('*, profiles:user_id (full_name, student_id)').order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).or(cursor).limit(300);
   if(error)throw Error('이전 GPU 예약을 불러오지 못했어요. 다시 시도해 주세요.');
   const currentSession=(await supabase.auth.getSession()).data.session;
   if(ticket!==generation.current||actor.current!==owner||currentSession?.user.id!==owner)return;
   setReservations(previous=>{const known=new Set(previous.map(row=>row.id));return [...previous,...(data||[]).filter(row=>!known.has(row.id))]});setGpuHasMore(data?.length===300);setLoadedAt(new Date().toISOString());
  }catch(e){if(ticket===generation.current&&actor.current===owner)setError(e instanceof Error?e.message:'이전 예약을 불러오지 못했어요.')}
  finally{if(olderReading.current===current)olderReading.current=null;if(ticket===generation.current&&actor.current===owner)setLoadingOlder(false)}
 }
 const pendingProfiles=useMemo(()=>profiles.filter(p=>p.is_approved!==true),[profiles]);
 const pendingReservations=useMemo(()=>reservations.filter(r=>matchesAdminGpuView(r,'pending',now)),[reservations,now]);
 const gpuHistory=useMemo(()=>filterAdminGpuReservations(reservations,{view:gpuView,gpu:gpuFilter,query:gpuQuery,now}),[reservations,gpuView,gpuFilter,gpuQuery,now]);
 const conflicts=(t:any)=>reservations.some(r=>r.id!==t.id&&r.gpu_id===t.gpu_id&&r.status==='approved'&&new Date(r.start_time)<new Date(t.end_time)&&new Date(r.end_time)>new Date(t.start_time));
 async function act(key:string,run:()=>Promise<string|null>){
  if(busyKey)return;setBusyKey(key);setError('');
  try{const failure=await run();if(failure)setError(failure);else await load()}catch(e){setError(e instanceof Error?e.message:'처리 결과를 확인하지 못했어요. 새로고침해 주세요.')}finally{setBusyKey('')}
 }
 const approveProfile=(id:string)=>act('p:'+id,async()=>{const {error}=await supabase.from('profiles').update({is_approved:true}).eq('id',id);return error?`승인하지 못했습니다: ${error.message}`:null});
 const markReview=(id:string)=>act('p:'+id,async()=>{const {error}=await supabase.from('profiles').update({is_approved:false}).eq('id',id);return error?`처리하지 못했습니다: ${error.message}`:null});
 const deleteProfile=(id:string)=>act('p:'+id,async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)return '로그인이 만료됐어요. 다시 로그인해 주세요.';const res=await fetch('/api/admin/delete-user',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({userId:id})});const body=await res.json().catch(()=>({}));return res.ok?null:(body?.message||'계정을 삭제하지 못했습니다.')});
 const approveReservation=(r:any)=>act('r:'+r.id,async()=>{if(!matchesAdminGpuView(r,'pending',Date.now()))return '진행 중인 승인 대기 예약만 처리할 수 있어요. 새로고침해 주세요.';if(conflicts(r))return '이미 승인된 예약과 시간이 겹쳐 승인할 수 없습니다.';const {error}=await supabase.rpc('approve_gpu_reservation',{p_reservation_id:r.id});return error?`승인하지 못했습니다: ${error.message}`:null});
 const rejectReservation=(r:any)=>act('r:'+r.id,async()=>{if(!matchesAdminGpuView(r,'pending',Date.now()))return '진행 중인 승인 대기 예약만 처리할 수 있어요. 새로고침해 주세요.';const {data,error}=await supabase.from('reservations').update({status:'rejected'}).eq('id',r.id).eq('status','pending').gt('end_time',new Date().toISOString()).select('id');return error||!data?.length?'거절하지 못했습니다. 예약 상태를 새로고침해 주세요.':null});
 if(authLoading)return <div className="flex min-h-dvh items-center justify-center"><LoadingSpinner label="권한 확인 중"/></div>;
 if(!isAdmin)return <div className="p-8 text-center text-sm text-muted-foreground">관리자만 볼 수 있습니다.</div>;
 // 상단바와 하단 탭은 앱 관리 틀(AppAdminFrame)이 그린다. 여기서는 내용만 그린다.
 return <div className="space-y-3">
 <h1 className="cb-page-title">{tabs.find(t=>t.id===tab)?.label}</h1>
 {error&&<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
 {loading&&!profiles.length&&!reservations.length?<div className="flex justify-center py-16"><LoadingSpinner label="불러오는 중"/></div>:<>
  {tab==='home'&&<div className="space-y-3">
   {study&&<a href="/admin/study" className="flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-5"><span className={`mt-0.5 ${healthTone[study.state]}`}><Activity className="size-6"/></span><span className="min-w-0 flex-1"><span className="block text-sm text-muted-foreground">자습 연결</span><span className={`block text-lg font-semibold ${healthTone[study.state]}`}>{study.label}</span><span className="mt-1 block text-sm text-muted-foreground">{study.detail}</span><span className="mt-2 block text-xs text-muted-foreground">{study.hoursLeft!==null&&<>토큰 만료까지 {leftText(study.hoursLeft)}</>}{study.minutesAgo!==null&&<>{study.hoursLeft!==null?' · ':''}마지막 점검 {study.minutesAgo}분 전</>}</span></span></a>}
   <button onClick={()=>go('signups')} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left"><span><span className="block text-sm text-muted-foreground">승인 대기 계정</span><span className="block text-3xl font-semibold">{pendingProfiles.length}<span className="ml-1 text-base font-medium">명</span></span></span><UserPlus className="size-6 text-primary"/></button>
   <button onClick={()=>go('gpu')} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left"><span><span className="block text-sm text-muted-foreground">대기 중인 GPU 예약</span><span className="block text-3xl font-semibold">{pendingReservations.length}<span className="ml-1 text-base font-medium">건</span></span></span><Cpu className="size-6 text-primary"/></button>
  </div>}
  {tab==='signups'&&(pendingProfiles.length?pendingProfiles.map(p=><article key={p.id} className="rounded-2xl border border-border bg-card p-4">
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-semibold">{p.full_name||'이름 없음'}</p><p className="text-sm text-muted-foreground">{p.student_id||'학번 없음'}</p></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Clock className="size-3"/>{p.is_approved===false?'확인 필요':'대기'}</span></div>
   <Button className="mt-4 min-h-11 w-full gap-2" disabled={!!busyKey} onClick={()=>void approveProfile(p.id)}>{busyKey==='p:'+p.id?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}승인</Button>
     <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11 gap-2" disabled={!!busyKey||p.is_approved===false} onClick={()=>void markReview(p.id)}><HelpCircle className="size-4"/>{p.is_approved===false?'확인 필요':'보류'}</Button><Button variant="outline" className="min-h-11 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10" disabled={!!busyKey} onClick={()=>setDeleteTarget({id:p.id,name:p.full_name||'이름 없음'})}><Trash2 className="size-4"/>거절</Button></div>
  </article>):<p className="py-16 text-center text-sm text-muted-foreground">승인 대기 중인 계정이 없습니다.</p>)}
  {tab==='gpu'&&<section aria-label="GPU 예약 전체 내역" className="space-y-3">
   <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">전체 예약 내역</h2><Button variant="outline" className="min-h-11 gap-2" aria-label="GPU 예약 새로고침" disabled={loading||!!busyKey} onClick={()=>void load()}><RefreshCw className="size-4"/>새로고침</Button></div>
    <p className="text-sm text-muted-foreground">승인 여부와 관계없이 종료된 예약까지 확인해요. 최근 예약부터 300건씩 불러와요.</p>

    <Input type="search" aria-label="GPU 예약 검색" value={gpuQuery} onChange={event=>setGpuQuery(event.target.value)} placeholder="이름, 학번, 이메일, GPU, 이용 목적" className="min-h-11"/>
    <div className="flex flex-wrap gap-2" aria-label="GPU 예약 상태">{gpuViews.map(view=><Button key={view.id} type="button" variant={gpuView===view.id?'default':'outline'} aria-pressed={gpuView===view.id} className="min-h-11" onClick={()=>setGpuView(view.id)}>{view.label}</Button>)}</div>
    <label className="grid gap-1 text-sm"><span>GPU 번호</span><Dropdown aria-label="GPU 번호 필터" value={gpuFilter} onChange={event=>setGpuFilter(event.target.value)} className="w-full"><option value="all">모든 GPU</option>{[1,2,3,4].map(id=><option key={id} value={String(id)}>GPU #{id}</option>)}</Dropdown></label>
    <p role="status" className="text-sm text-muted-foreground">{loading?'새로 불러오는 중…':`조회 ${reservations.length}건 · 검색 결과 ${gpuHistory.length}건 · ${Math.min(visibleGpu,gpuHistory.length)}건 표시`}</p>
    {loadedAt&&<p className="text-xs text-muted-foreground">마지막 조회 · {fmt(loadedAt)}</p>}
   </div>
   {gpuHistory.length?gpuHistory.slice(0,visibleGpu).map(r=>{const reviewable=matchesAdminGpuView(r,'pending',now),clash=reviewable&&conflicts(r),ended=matchesAdminGpuView(r,'ended',now);return <article key={r.id} data-reservation-id={r.id} className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-base font-semibold">{r.profiles?.full_name||'계정 정보 없음'}</p><p className="break-all text-sm text-muted-foreground">{r.profiles?.student_id||r.user_email||r.id}</p></div><span className="shrink-0 text-base font-semibold text-primary">GPU #{r.gpu_id}</span></div>
    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-muted px-2.5 py-1">{statusLabel(r.status)}</span><span className="rounded-full bg-muted px-2.5 py-1">{ended?'종료':Date.parse(r.start_time)>now?'시작 전':'예약 시간 진행 중'}</span></div>
    <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">{fmt(r.start_time)} → {fmt(r.end_time)}</p>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">이용 목적 · {r.purpose||'입력된 목적 없음'}</p>
    {clash&&<p className="mt-2 text-sm font-semibold text-destructive">이미 승인된 예약과 시간이 겹쳐요</p>}
    {reviewable&&<div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11 gap-2" disabled={!!busyKey} onClick={()=>void rejectReservation(r)}><X className="size-4"/>거절</Button><Button className="min-h-11 gap-2" disabled={!!busyKey||clash} onClick={()=>void approveReservation(r)}>{busyKey==='r:'+r.id?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}승인</Button></div>}
   </article>}):<p className="py-12 text-center text-sm text-muted-foreground">{gpuQuery||gpuFilter!=='all'||gpuView!=='all'?'조건에 맞는 GPU 예약이 없어요. 검색과 필터를 변경해 주세요.':'표시할 GPU 예약이 없어요.'}</p>}
   {visibleGpu<gpuHistory.length&&<Button type="button" variant="outline" className="min-h-11 w-full" onClick={()=>setVisibleGpu(value=>value+30)}>예약 더 보기 ({gpuHistory.length-Math.min(visibleGpu,gpuHistory.length)}건 남음)</Button>}
   {gpuHasMore&&<Button type="button" variant="outline" className="min-h-11 w-full" disabled={loading||loadingOlder||!!busyKey} onClick={()=>void loadOlder()}>{loadingOlder?'이전 예약 불러오는 중…':'이전 예약 불러오기'}</Button>}
  </section>}
  {tab==='more'&&<div className="space-y-3">
   <a href="/admin/gpu" className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5 text-base font-semibold">전체 관리 화면 <ExternalLink className="size-4 text-muted-foreground"/></a>
   <a href={siteHref('https://app.cbgpu.com/')} className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5 text-base font-semibold">CBGPU 앱으로 돌아가기 <ArrowLeft className="size-4 text-muted-foreground"/></a>
  </div>}
 </>}
 <ConfirmDialog open={!!deleteTarget} title="가입을 거절할까요?" description={`${deleteTarget?.name??''} 님의 계정이 삭제되고 더 이상 로그인할 수 없어요. 되돌릴 수 없어요.`} confirmLabel={busyKey?'삭제 중…':'거절하고 삭제'} cancelLabel="취소" onConfirm={()=>{const t=deleteTarget;setDeleteTarget(null);if(t)void deleteProfile(t.id)}} onCancel={()=>setDeleteTarget(null)}/>
 </div>;
}
