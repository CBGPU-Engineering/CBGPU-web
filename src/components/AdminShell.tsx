'use client';
import Link from 'next/link';
import Image from 'next/image';
import {WorkspaceThemeControl} from '@/components/publications/WorkspaceTheme';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {Cpu,Server,Users,Printer,Files,KeyRound,Music,CalendarDays,Vote,ArrowUpRight,UserCircle,RefreshCw} from 'lucide-react';
import AppAdminFrame from '@/components/admin/AppAdminFrame';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import './admin/developer-shell.css';
import './admin/admin-content.css';
const links=[
 {href:'/admin/gpu',key:'gpu',label:'GPU reservations',Icon:Cpu},
 {href:'/admin/server',key:'server',label:'Server deployments',Icon:Server},
 {href:'/admin/accounts',key:'accounts',label:'Accounts',Icon:Users},
 {href:'/admin/careers',key:'careers',label:'Careers',Icon:Users},
 {href:'/admin/manufacture',key:'manufacture',label:'Equipment managers',Icon:Printer},
 {href:'/admin/materials',key:'materials',label:'File storage',Icon:Files},
 {href:'/admin/study',key:'study',label:'Study settings',Icon:KeyRound},
 {href:'/admin/wakeup',key:'wakeup',label:'Wake-up music',Icon:Music},
 {href:'/admin/timetable',key:'timetable',label:'Timetable',Icon:CalendarDays},
 {href:'/admin/polls',key:'polls',label:'Polls',Icon:Vote},
 {href:'/admin/manufacturing',key:'manufacturing',label:'Manufacturing',Icon:Printer},
];
export default function AdminShell({children,appWebView=false}:{children:React.ReactNode;appWebView?:boolean}){
 const pathname=usePathname(),params=useSearchParams(),router=useRouter(),section=pathname==='/admin'?(params.get('section')||'gpu'):pathname.split('/')[2],current=links.find(x=>x.key===section);const {user,profile}=useAuth();const {theme,resolvedTheme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const el=event.target as HTMLElement;if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!el.isContentEditable&&!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)){event.preventDefault();window.dispatchEvent(new Event('admin:search-list'));}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 async function logout(){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/portal/session',{cache:'no-store'});if(r.ok){const session=await r.json();const out=await fetch('/portal/api/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:'{}'});if(!out.ok)throw Error('Sign-out failed.')}await supabase.auth.signOut({scope:'local'});window.location.replace('/')}catch{setError('Could not sign out. Please try again.');setBusy(false)}}
 // 앱 웹뷰(서버가 UA의 '; wv)'로 판별)와 폰 전용 화면(/admin/m)은 사이드바 대신 앱 상단바·하단 탭 틀을 쓴다.
 if(appWebView||pathname==='/admin/m'||pathname.startsWith('/admin/m/'))return <AppAdminFrame>{children}</AppAdminFrame>;
 return <div className="admin-developer-shell" data-theme={mounted?resolvedTheme:undefined}>
  <div className="portal">
   <aside className="sidebar" aria-label="Admin sidebar"><Link href="/admin" className="brand" aria-label="CBGPU Admin overview"><Image src="/img/cbgpu-logo.png" alt="" width={30} height={30}/><span className="brand-word">CBGPU<small>Admin</small></span></Link>
    <p className="nav-caption">Workspace</p><nav className="navigation" aria-label="Admin tools">{links.map(({href,key,label,Icon})=><Link key={key} href={href} aria-current={section===key?'page':undefined} className={'nav-item'+(section===key?' active':'')}><Icon className="icon" strokeWidth={1.6}/>{label}</Link>)}</nav>
    <div className="sidebar-bottom"><div className="account-summary"><p>{profile?.full_name||user?.email||'Administrator'}</p><p className="meta">{user?.email}</p></div><a href="https://cbgpu.com" target="_blank" rel="noopener noreferrer">Open cbgpu.com<ArrowUpRight className="icon"/></a><button type="button" className="button ghost" onClick={logout} disabled={busy}>{busy?'Signing out…':'Sign out'}</button></div>
   </aside>
   <div className="workspace"><header className="workspace-header"><div className="breadcrumbs"><span>CBGPU</span><span className="breadcrumb-divider">/</span><strong>{current?.label||'Administration'}</strong><span className="environment-badge"><span className="status-dot healthy" aria-hidden="true"/>Production</span></div><div className="header-actions"><button type="button" className="account-button" aria-label="Account management" onClick={()=>router.push('/admin/accounts')}><UserCircle className="icon" strokeWidth={1.6}/><span>{profile?.full_name||'Account'}</span></button><WorkspaceThemeControl/><button type="button" className="button secondary" onClick={()=>window.location.reload()}><RefreshCw className="icon" strokeWidth={1.5}/>Refresh</button></div></header>
    <main id="main-content" tabIndex={-1}>{error&&<p role="alert" className="notice error">{error}</p>}{children}</main><footer className="workspace-footer"><span>CBGPU Admin</span><span>admin.cbgpu.com</span></footer>
   </div>
  </div>
 </div>
}
