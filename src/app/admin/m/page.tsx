'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {DropdownMenu as ModeMenu} from 'radix-ui';
import {useTheme} from 'next-themes';
import '@/components/workspaces/workspaces.css';
import '@/components/workspaces/audience-design.css';
import '@/components/workspaces/app-layout.css';
import {useRouter,useSearchParams} from 'next/navigation';
import {Check,Clock,Cpu,ExternalLink,LayoutDashboard,MoreHorizontal,RefreshCw,UserPlus,X,ArrowLeft,Loader2,ChevronDown,GraduationCap,FlaskConical,ShieldCheck,Moon,Sun} from 'lucide-react';
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
const tabs:{id:Tab;label:string;Icon:typeof LayoutDashboard}[]=[{id:'home',label:'요약',Icon:LayoutDashboard},{id:'signups',label:'가입 승인',Icon:UserPlus},{id:'gpu',label:'GPU 예약',Icon:Cpu},{id:'more',label:'더보기',Icon:MoreHorizontal}];
const fmt=(v:string)=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
export default function MobileAdminPage(){
 const {isLoading:authLoading,isAdmin}=useAuth();
 const router=useRouter(),params=useSearchParams(),{resolvedTheme,setTheme}=useTheme();
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
 const Count=({n}:{n:number})=>n>0?<span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{n}</span>:null;
 const appHome=(id:string)=>siteHref(`https://app.cbgpu.com/?mode=${id}`);
 const spaceRows=[{id:'student',label:'학교생활',sub:'자습 · 시간표 · 급식 · 자료 공유',Icon:GraduationCap},{id:'researcher',label:'연구·개발',sub:'GPU · 웹사이트 배포 · 논문 · 제작',Icon:FlaskConical}];
 // 학교생활·연구개발 화면과 같은 틀(.cb-workspace.cb-app)을 그대로 써서 상단바·하단 탭이 완전히 같게 보인다. "관리"는 같은 공간 전환 메뉴의 한 항목이다.
 return <div className="cb-workspace cb-app" style={{'--workspace-accent':'var(--primary)'} as React.CSSProperties}>
  <div className="cb-workspace-body">
   <header className="cb-workspace-header cb-app-header">
    <a href={appHome('student')} className="cb-app-brand" aria-label="CBGPU 앱 홈"><Image src="/img/cbgpu-logo.png" width={34} height={34} alt="CBGPU"/></a>
    <ModeMenu.Root>
     <ModeMenu.Trigger asChild><button className="cb-app-mode-trigger" aria-label="CBGPU 공간 선택" data-current-mode="admin"><span><small>CBGPU</small><strong>관리</strong></span><ChevronDown size={14}/></button></ModeMenu.Trigger>
     <ModeMenu.Portal><ModeMenu.Content className="cb-app-mode-menu" align="center" sideOffset={12} collisionPadding={12}>
      <div className="cb-mode-menu-heading"><strong>어떤 공간에서 시작할까요?</strong><span>같은 계정으로 자유롭게 바꿀 수 있어요.</span></div>
      <ModeMenu.RadioGroup value="admin">
       {spaceRows.map(({id,label,sub,Icon})=><ModeMenu.RadioItem key={id} value={id} onSelect={()=>window.location.assign(appHome(id))} className="cb-app-mode-option"><span className="cb-mode-option-icon"><Icon size={21}/></span><span><strong>{label}</strong><small>{sub}</small></span></ModeMenu.RadioItem>)}
       <ModeMenu.RadioItem value="admin" className="cb-app-mode-option"><span className="cb-mode-option-icon" style={{color:'var(--primary)'}}><ShieldCheck size={21}/></span><span><strong>관리</strong><small>가입 승인 · GPU 예약</small></span><ModeMenu.ItemIndicator><Check size={17}/></ModeMenu.ItemIndicator></ModeMenu.RadioItem>
      </ModeMenu.RadioGroup>
      <ModeMenu.Separator className="cb-mode-menu-divider"/>
      <ModeMenu.Item aria-label="화면 테마 전환" className="cb-mode-menu-theme" onSelect={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>{resolvedTheme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{resolvedTheme==='dark'?'라이트 모드로 전환':'다크 모드로 전환'}</span></ModeMenu.Item>
     </ModeMenu.Content></ModeMenu.Portal>
    </ModeMenu.Root>
    <div className="cb-header-actions"><button aria-label="새로고침" disabled={loading} onClick={()=>void load()}><RefreshCw size={19} className={loading?'animate-spin':''}/></button></div>
   </header>
   <main id="main-content" className="cb-workspace-content" tabIndex={-1} style={{paddingBottom:'calc(110px + env(safe-area-inset-bottom))'}}>
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
   </main>
  </div>
  <nav className="cb-bottom-nav" aria-label="관리 메뉴" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>{tabs.map(({id,label,Icon})=><Link key={id} href={id==='home'?'/admin/m':`/admin/m?tab=${id}`} replace className={tab===id?'active':''} aria-current={tab===id?'page':undefined}><Icon size={20}/><span className="inline-flex items-center">{label}{id==='signups'&&<Count n={pendingProfiles.length}/>}{id==='gpu'&&<Count n={pendingReservations.length}/>}</span></Link>)}</nav>
 </div>;
}
