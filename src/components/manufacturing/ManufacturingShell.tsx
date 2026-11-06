'use client';
import {WorkspaceThemeControl} from '@/components/publications/WorkspaceTheme';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname,useSearchParams} from 'next/navigation';
import {useAppFrame} from '@/lib/useAppFrame';
import AppSpaceFrame,{type SpaceNavItem} from '@/components/admin/AppSpaceFrame';
import {useTheme} from 'next-themes';
import {Printer,Layers,List,ArrowUpRight,RefreshCw,UserCircle} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {equipmentAccessView,type EquipmentAccess} from '@/lib/equipmentAccessState';
import EquipmentAccessStatus from './EquipmentAccessStatus';
import '../admin/developer-shell.css';
import '../admin/admin-content.css';
const EquipmentContext=createContext<'print'|'laser'|null>(null);
export const useEquipmentKind=()=>useContext(EquipmentContext);
/** Developer portal shell with equipment-specific navigation and content. */
export default function ManufacturingShell({children,equipmentKind,appWebView=false}:{children:React.ReactNode;equipmentKind:'print'|'laser';appWebView?:boolean}){
 const {user,profile,isLoading}=useAuth(),path=usePathname(),{theme,resolvedTheme,setTheme}=useTheme();
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 const [access,setAccess]=useState<EquipmentAccess>('loading'),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [equipment,setEquipment]=useState({print:false,laser:false});
 // 앱 틀에서는 프린트·레이저를 하나의 제작 공간으로 묶어, 내 권한(print/laser)에 해당하는 것만 보여 준다. 어느 쪽을 볼지는 ?kind=print|laser로 정한다.
 const appFrame=useAppFrame(appWebView),params=useSearchParams(),wantedKind=params.get('kind');
 const kind:'print'|'laser'=appFrame?(wantedKind==='laser'&&equipment.laser?'laser':wantedKind==='print'&&equipment.print?'print':equipment.print?'print':equipment.laser?'laser':equipmentKind):equipmentKind;
 const name=kind==='print'?'3D Printing':'Laser Cutting',host=kind==='print'?'print.cbgpu.com':'laser.cbgpu.com';
 const permittedDetail=(!path.includes('/print/')||equipment.print)&&(!path.includes('/laser/')||equipment.laser)&&!(kind==='print'&&path.endsWith('/materials'))&&!(kind==='laser'&&/\/(queues|filament)$/.test(path));
 const [authTimedOut,setAuthTimedOut]=useState(false);
 useEffect(()=>{setAuthTimedOut(false);if(!isLoading)return;const timer=setTimeout(()=>setAuthTimedOut(true),10000);return()=>clearTimeout(timer)},[isLoading]);
 useEffect(()=>{
  if(!user){setAccess('unauthenticated');setEquipment({print:false,laser:false});return}
  let cancelled=false;const controller=new AbortController();setAccess('loading');
  const timer=setTimeout(()=>{if(!cancelled){cancelled=true;controller.abort();setAccess('error')}},10000);
  void(async()=>{try{
   const {data:{session}}=await supabase.auth.getSession();if(cancelled)return;
   if(!session){setAccess('unauthenticated');return}
   const response=await fetch('/api/manufacturing/access',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:controller.signal});
   if(cancelled)return;
   if(response.ok){const permissions=await response.json();if(cancelled)return;setEquipment(permissions);setAccess('allowed')}
   else setAccess(response.status===401?'unauthenticated':response.status===403?'denied':'error');
  }catch{if(!cancelled)setAccess('error')}finally{clearTimeout(timer)}})();
  return()=>{cancelled=true;controller.abort();clearTimeout(timer)};
 },[user,refresh,path]);
 const gate=equipmentAccessView({isLoading,authTimedOut,signedIn:!!user,access,permittedDetail});
 function retryAccess(){if(authTimedOut)window.location.reload();else setRefresh(value=>value+1)}

 async function logout(){if(busy)return;setBusy(true);setError('');try{const response=await fetch('/portal/session',{cache:'no-store'});if(response.ok){const session=await response.json();const out=await fetch('/portal/api/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:'{}'});if(!out.ok)throw Error()}await supabase.auth.signOut({scope:'local'});window.location.replace('/')}catch{setError('Could not sign out. Please try again.');setBusy(false)}}
 const links=kind==='print'?[{href:'/manage/manufacturing',label:'Overview',Icon:Printer},{href:'/manage/manufacturing/requests',label:'Print requests',Icon:List},{href:'/manage/manufacturing/queues',label:'Printer queues',Icon:Printer},{href:'/manage/manufacturing/filament',label:'Filament stock',Icon:Layers}]:[{href:'/manage/manufacturing/requests',label:'Cutting requests',Icon:List},{href:'/manage/manufacturing/materials',label:'Materials',Icon:Layers}];
 const activePath=/\/(?:print|laser)\//.test(path)?'/manage/manufacturing/requests':path==='/manage/manufacturing'&&kind==='laser'?'/manage/manufacturing/requests':path;
 const current=links.find(link=>link.href===activePath);

 if(appFrame){
  const both=equipment.print&&equipment.laser;
  const items:SpaceNavItem[]=[
   ...(equipment.print?[{id:'print:overview',href:'/manage/manufacturing?kind=print',label:both?'프린트 개요':'개요',Icon:Printer},{id:'print:requests',href:'/manage/manufacturing/requests?kind=print',label:both?'프린트 요청':'요청',Icon:List},{id:'print:queues',href:'/manage/manufacturing/queues?kind=print',label:'프린터 대기열',Icon:Printer},{id:'print:filament',href:'/manage/manufacturing/filament?kind=print',label:'필라멘트',Icon:Layers}]:[]),
   ...(equipment.laser?[{id:'laser:requests',href:'/manage/manufacturing/requests?kind=laser',label:both?'레이저 요청':'요청',Icon:List},{id:'laser:materials',href:'/manage/manufacturing/materials?kind=laser',label:both?'레이저 재료':'재료',Icon:Layers}]:[]),
  ];
  const detailKind=path.includes('/print/')?'print':path.includes('/laser/')?'laser':null;
  const segment=path.replace('/manage/manufacturing','').replace(/^\//,'')||'overview',section=detailKind?'requests':segment,activeKind=detailKind||kind;
  const activeId=activeKind==='laser'&&section==='overview'?'laser:requests':activeKind+':'+section;
  return <EquipmentContext.Provider value={kind}><AppSpaceFrame current="manufacturing" nav={items} activeId={activeId}>{error&&<p role="alert" className="notice error">{error}</p>}{path.startsWith('/auth/')||gate==='allowed'?children:<EquipmentAccessStatus state={gate} onRetry={retryAccess}/>}</AppSpaceFrame></EquipmentContext.Provider>;
 }
 return <EquipmentContext.Provider value={kind}><div className="admin-developer-shell equipment-shell" data-equipment-kind={kind} data-theme={mounted?resolvedTheme:undefined}><div className="portal"><aside className="sidebar" aria-label="Equipment sidebar"><Link href="/manage/manufacturing" className="brand"><Image src="/img/cbgpu-logo.png" alt="" width={30} height={30}/><span className="brand-word">CBGPU<small>{name}</small></span></Link><p className="nav-caption">Workspace</p><nav className="navigation" aria-label="Equipment tools">{links.map(({href,label,Icon})=><Link key={href} href={href} aria-current={href===activePath?'page':undefined} className={'nav-item'+(href===activePath?' active':'')}><Icon className="icon" strokeWidth={1.6}/>{label}</Link>)}</nav><div className="sidebar-bottom"><div className="account-summary"><p>{profile?.full_name||user?.email||'Equipment manager'}</p><p className="meta">{user?.email}</p></div><a href="https://researcher.cbgpu.com/manufacturing" target="_blank" rel="noopener noreferrer">Open request page <ArrowUpRight className="icon"/></a><button className="button ghost" onClick={()=>void logout()} disabled={busy}>{busy?'Signing out…':'Sign out'}</button></div></aside><div className="workspace"><header className="workspace-header"><div className="breadcrumbs"><span>CBGPU</span><span className="breadcrumb-divider">/</span><strong>{current?.label||name}</strong><span className="environment-badge"><span className="status-dot healthy"/>Production</span></div><div className="header-actions"><div className="account-button"><UserCircle className="icon" strokeWidth={1.6}/><span>{profile?.full_name||'Account'}</span></div><WorkspaceThemeControl/><button className="button secondary" onClick={()=>setRefresh(n=>n+1)}><RefreshCw className="icon" strokeWidth={1.5}/>Refresh</button></div></header><main id="main-content" tabIndex={-1}>{error&&<p role="alert" className="notice error">{error}</p>}{path.startsWith('/auth/')||gate==='allowed'?children:<EquipmentAccessStatus state={gate} onRetry={retryAccess}/>}</main><footer className="workspace-footer"><span>CBGPU {name}</span><span>{host}</span></footer></div></div></div></EquipmentContext.Provider>
}
