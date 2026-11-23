'use client';
import CBGPULogo from '@/components/CBGPULogo';
import Link from 'next/link';
import {WorkspaceThemeControl} from '@/components/publications/WorkspaceTheme';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {Server,Users,Files,ArrowUpRight,UserCircle,RefreshCw,Menu,X} from 'lucide-react';
import {useAppFrame} from '@/lib/useAppFrame';
import AppAdminFrame from '@/components/admin/AppAdminFrame';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import './admin/developer-shell.css';
import './admin/admin-content.css';
import './admin/platform-admin.css';
import {platformAdminSchool} from '@/lib/platformAdminNavigation';
const links=[
 ...(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?[{href:'/admin/schools',key:'schools',label:'Schools',Icon:Users},{href:'/admin/school-applications',key:'school-applications',label:'School applications',Icon:Files},{href:'/admin/feature-requests',key:'feature-requests',label:'School feature requests',Icon:Files},{href:'/admin/message-reports',key:'message-reports',label:'Message reports',Icon:Users}]:[]),
 {href:'/admin/server',key:'server',label:'Server deployments',Icon:Server},
 {href:'/admin/accounts',key:'accounts',label:'Accounts',Icon:Users},
 ...(process.env.NEXT_PUBLIC_CBGPU_AD_REVENUE_V1==='1'?[{href:'/admin/ad-revenue',key:'ad-revenue',label:'Ad revenue',Icon:Files}]:[]),
 {href:'/admin/careers',key:'careers',label:'Careers',Icon:Users},
];
export default function AdminShell({children,appWebView=false}:{children:React.ReactNode;appWebView?:boolean}){
 const pathname=usePathname(),params=useSearchParams(),router=useRouter(),section=pathname==='/admin'?(params.get('section')||(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?'schools':'gpu')):pathname.split('/')[2],current=links.find(x=>x.key===section);const {user,profile}=useAuth();const appFrame=useAppFrame(appWebView);const {theme,resolvedTheme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const [busy,setBusy]=useState(false),[error,setError]=useState(''),[menuOpen,setMenuOpen]=useState(false);
 const multi=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1',school=multi?platformAdminSchool(pathname,params.get('section')):null;
 const navigationKey=pathname+'?'+params.toString();
 useEffect(()=>setMenuOpen(false),[navigationKey]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const el=event.target as HTMLElement;if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!el.isContentEditable&&!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)){event.preventDefault();window.dispatchEvent(new Event('admin:search-list'));}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 async function logout(){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/portal/session',{cache:'no-store'});if(r.ok){const session=await r.json();const out=await fetch('/portal/api/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:'{}'});if(!out.ok)throw Error('Sign-out failed.')}await supabase.auth.signOut({scope:'local'});window.location.replace('/')}catch{setError('Could not sign out. Please try again.');setBusy(false)}}
 // 앱 웹뷰(서버가 UA의 '; wv)'로 판별)와 폰 전용 화면(/admin/m)은 사이드바 대신 앱 상단바·하단 탭 틀을 쓴다.
 if(appFrame||pathname==='/admin/m'||pathname.startsWith('/admin/m/'))return <AppAdminFrame>{children}</AppAdminFrame>;
 const navLink=({href,key,label,Icon}:typeof links[number])=><Link key={key} href={href} aria-current={!school&&section===key?'page':undefined} className={'nav-item'+(!school&&section===key?' active':'')}><Icon className="icon" strokeWidth={1.6}/><span>{key==='accounts'?'Platform accounts':label}</span></Link>;
 return <div className={'admin-developer-shell'+(multi?' cb-platform-admin-shell':'')} data-theme={mounted?resolvedTheme:undefined}>
  <div className="portal">
   <aside className="sidebar" aria-label="Admin sidebar" data-menu-open={menuOpen}>
    <div className="cb-admin-sidebar-brand"><Link href={multi?'/admin/schools':'/admin'} className="brand" aria-label="CBGPU Admin overview"><CBGPULogo alt="" width={30} height={30}/><span className="brand-word">CBGPU<small>Admin</small></span></Link><button type="button" className="cb-admin-menu-toggle" onClick={()=>setMenuOpen(value=>!value)} aria-expanded={menuOpen} aria-controls="platform-admin-navigation" aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button></div>
    <div id="platform-admin-navigation" className="cb-admin-navigation-panel">
     <p className="nav-caption">Platform tools</p><nav className="navigation" aria-label="Platform tools">{links.map(navLink)}</nav>
     <p className="cb-admin-scope-note">School operations are available in your authorized school workspace.</p>
    </div>
    <div className="sidebar-bottom"><div className="account-summary"><p>{profile?.full_name||user?.email||'Administrator'}</p><p className="meta">{user?.email}</p></div><a href="https://cbgpu.com" target="_blank" rel="noopener noreferrer">Open cbgpu.com<ArrowUpRight className="icon"/></a><button type="button" className="button ghost" onClick={logout} disabled={busy}>{busy?'Signing out…':'Sign out'}</button></div>
   </aside>
   <div className="workspace"><header className="workspace-header"><div className="breadcrumbs"><span>CBGPU Admin</span><span className="breadcrumb-divider">/</span><strong>{school?'School inspection':section==='accounts'?'Platform accounts':current?.label||'Administration'}</strong></div><div className="header-actions"><button type="button" className="account-button" aria-label="Platform account management" onClick={()=>router.push('/admin/accounts')}><UserCircle className="icon" strokeWidth={1.6}/><span>{profile?.full_name||'Account'}</span></button><WorkspaceThemeControl/><button type="button" className="button secondary" onClick={()=>window.location.reload()}><RefreshCw className="icon" strokeWidth={1.5}/>Refresh</button></div></header>
    <main id="main-content" tabIndex={-1}>{error&&<p role="alert" className="notice error">{error}</p>}{children}</main><footer className="workspace-footer"><span>{'Platform administration'}</span><span>admin.cbgpu.com</span></footer>
   </div>
  </div>
 </div>
}
