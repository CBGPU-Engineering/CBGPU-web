'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {Check,Clock,Cpu,ExternalLink,UserPlus,X,ArrowLeft,Loader2} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/lib/useAuth';
import {siteHref} from '@/lib/siteHref';
import {LoadingSpinner} from '@/components/ui/spinner';
import {Button} from '@/components/ui/button';
/**
 * 앱(폰) 전용 관리 화면. 데이터·권한은 기존 관리자 화면과 같다(같은 Supabase 쿼리와 RLS, 같은 /api/admin/profiles).
 * admin.cbgpu.com 안에 있으므로 별도 인증 경계는 그대로이고, 표 대신 카드 + 하단 네비게이션으로 보여 준다.
 */
type Tab='home'|'signups'|'gpu'|'more';
const tabs:{id:Tab;label:string}[]=[{id:'home',label:'요약'},{id:'signups',label:'가입 승인'},{id:'gpu',label:'GPU 예약'},{id:'more',label:'더보기'}];
const fmt=(v:string)=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
export default function MobileAdminPage(){
 const {isLoading:authLoading,isAdmin}=useAuth();
 const router=useRouter(),params=useSearchParams();
 const param=params.get('tab') as Tab|null;
 const tab:Tab=param&&tabs.some(t=>t.id===param)?param:'home';
 const [profiles,setProfiles]=useState<any[]>([]),[reservations,setReservations]=useState<any[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busyKey,setBusyKey]=useState('');
 const go=(next:Tab)=>router.replace(`/admin/m${next==='home'?'':`?tab=${next}`}`);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const [p,r]=await Promise.all([
    fetch('/api/admin/profiles',{headers:{Authorization:`Bearer ${session?.access_token||''}`},cache:'no-store'}).then(async x=>{const j=await x.json();if(!x.ok)throw new Error(j.error||'계정을 불러오지 못했습니다.');return j.profiles||[]}),
    supabase.from('reservations').select('*, profiles:user_id (full_name, student_id)').order('created_at',{ascending:false}).limit(300).then(({data,error})=>{if(error)throw new Error('GPU 예약을 불러오지 못했습니다.');return data||[]}),
   ]);
   setProfiles(p);setReservations(r);
  }catch(e){setError(e instanceof Error?e.message:'불러오지 못했습니다.')}
  setLoading(false);
 },[]);
 useEffect(()=>{if(!authLoading&&isAdmin)void load()},[authLoading,isAdmin,load]);
 const pendingProfiles=useMemo(()=>profiles.filter(p=>p.is_approved!==true),[profiles]);
 const pendingReservations=useMemo(()=>reservations.filter(r=>r.status==='pending'&&new Date(r.end_time)>new Date()),[reservations]);
 const conflicts=(t:any)=>reservations.some(r=>r.id!==t.id&&r.gpu_id===t.gpu_id&&r.status==='approved'&&new Date(r.start_time)<new Date(t.end_time)&&new Date(r.end_time)>new Date(t.start_time));
 async function act(key:string,run:()=>Promise<string|null>){
  if(busyKey)return;setBusyKey(key);setError('');
  try{const failure=await run();if(failure)setError(failure);else await load()}finally{setBusyKey('')}
 }
 const approveProfile=(id:string)=>act('p:'+id,async()=>{const {error}=await supabase.from('profiles').update({is_approved:true}).eq('id',id);return error?`승인하지 못했습니다: ${error.message}`:null});
 const approveReservation=(r:any)=>act('r:'+r.id,async()=>{if(conflicts(r))return '이미 승인된 예약과 시간이 겹쳐 승인할 수 없습니다.';const {error}=await supabase.rpc('approve_gpu_reservation',{p_reservation_id:r.id});return error?`승인하지 못했습니다: ${error.message}`:null});
 const rejectReservation=(r:any)=>act('r:'+r.id,async()=>{const {data,error}=await supabase.from('reservations').update({status:'rejected'}).eq('id',r.id).select('id');return error||!data?.length?'거절하지 못했습니다.':null});
 if(authLoading)return <div className="flex min-h-dvh items-center justify-center"><LoadingSpinner label="권한 확인 중"/></div>;
 if(!isAdmin)return <div className="p-8 text-center text-sm text-muted-foreground">관리자만 볼 수 있습니다.</div>;
 // 상단바와 하단 탭은 앱 관리 틀(AppAdminFrame)이 그린다. 여기서는 내용만 그린다.
 return <div className="space-y-3">
 <h1 className="cb-page-title">{tabs.find(t=>t.id===tab)?.label}</h1>
 {error&&<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
 {loading&&!profiles.length&&!reservations.length?<div className="flex justify-center py-16"><LoadingSpinner label="불러오는 중"/></div>:<>
  {tab==='home'&&<div className="space-y-3">
   <button onClick={()=>go('signups')} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left"><span><span className="block text-sm text-muted-foreground">승인 대기 계정</span><span className="block text-3xl font-semibold">{pendingProfiles.length}<span className="ml-1 text-base font-medium">명</span></span></span><UserPlus className="size-6 text-primary"/></button>
   <button onClick={()=>go('gpu')} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left"><span><span className="block text-sm text-muted-foreground">대기 중인 GPU 예약</span><span className="block text-3xl font-semibold">{pendingReservations.length}<span className="ml-1 text-base font-medium">건</span></span></span><Cpu className="size-6 text-primary"/></button>
  </div>}
  {tab==='signups'&&(pendingProfiles.length?pendingProfiles.map(p=><article key={p.id} className="rounded-2xl border border-border bg-card p-4">
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-semibold">{p.full_name||'이름 없음'}</p><p className="text-sm text-muted-foreground">{p.student_id||'학번 없음'}</p></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Clock className="size-3"/>{p.is_approved===false?'확인 필요':'대기'}</span></div>
   <Button className="mt-4 min-h-11 w-full gap-2" disabled={!!busyKey} onClick={()=>void approveProfile(p.id)}>{busyKey==='p:'+p.id?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}승인</Button>
  </article>):<p className="py-16 text-center text-sm text-muted-foreground">승인 대기 중인 계정이 없습니다.</p>)}
  {tab==='gpu'&&(pendingReservations.length?pendingReservations.map(r=>{const clash=conflicts(r);return <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-semibold">{r.profiles?.full_name||'계정 정보 없음'}</p><p className="text-sm text-muted-foreground">{r.profiles?.student_id||r.user_email}</p></div><span className="shrink-0 text-base font-semibold text-primary">GPU #{r.gpu_id}</span></div>
   <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">{fmt(r.start_time)} → {fmt(r.end_time)}</p>
   {r.purpose&&<p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.purpose}</p>}
   {clash&&<p className="mt-2 text-sm font-semibold text-destructive">이미 승인된 예약과 시간이 겹쳐요</p>}
   <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11 gap-2" disabled={!!busyKey} onClick={()=>void rejectReservation(r)}><X className="size-4"/>거절</Button><Button className="min-h-11 gap-2" disabled={!!busyKey||clash} onClick={()=>void approveReservation(r)}>{busyKey==='r:'+r.id?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}승인</Button></div>
  </article>}):<p className="py-16 text-center text-sm text-muted-foreground">대기 중인 GPU 예약이 없습니다.</p>)}
  {tab==='more'&&<div className="space-y-3">
   <a href="/admin/gpu" className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5 text-base font-semibold">전체 관리 화면 <ExternalLink className="size-4 text-muted-foreground"/></a>
   <a href={siteHref('https://app.cbgpu.com/')} className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5 text-base font-semibold">CBGPU 앱으로 돌아가기 <ArrowLeft className="size-4 text-muted-foreground"/></a>
  </div>}
 </>}
 </div>;
}
