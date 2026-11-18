'use client';
import CBGPULogo from '@/components/CBGPULogo';
import Link from 'next/link';
import {WorkspaceThemeControl} from '@/components/publications/WorkspaceTheme';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {Cpu,Server,Users,Printer,Files,KeyRound,Music,CalendarDays,Vote,ArrowUpRight,UserCircle,RefreshCw,Menu,X,Settings,ShieldCheck,ChevronDown} from 'lucide-react';
import {useAppFrame} from '@/lib/useAppFrame';
import AppAdminFrame from '@/components/admin/AppAdminFrame';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import './admin/developer-shell.css';
import './admin/admin-content.css';
import './admin/platform-admin.css';
import PlatformSchoolPicker from '@/components/schools/PlatformSchoolPicker';
import {schoolAdminSections,schoolAdminHref} from '@/lib/schoolAdministration';
import {platformAdminSchool,platformSchoolAdminHref} from '@/lib/platformAdminNavigation';
const links=[
 ...(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?[{href:'/admin/schools',key:'schools',label:'Schools',Icon:Users},{href:'/admin/school-applications',key:'school-applications',label:'School applications',Icon:Files},{href:'/admin/feature-requests',key:'feature-requests',label:'School feature requests',Icon:Files},{href:'/admin/message-reports',key:'message-reports',label:'Message reports',Icon:Users}]:[]),
 {href:'/admin/gpu',key:'gpu',label:'GPU reservations',Icon:Cpu},
 {href:'/admin/server',key:'server',label:'Server deployments',Icon:Server},
 {href:'/admin/accounts',key:'accounts',label:'Accounts',Icon:Users},
 ...(process.env.NEXT_PUBLIC_CBGPU_AD_REVENUE_V1==='1'?[{href:'/admin/ad-revenue',key:'ad-revenue',label:'Ad revenue',Icon:Files}]:[]),
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
 const pathname=usePathname(),params=useSearchParams(),router=useRouter(),section=pathname==='/admin'?(params.get('section')||(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?'schools':'gpu')):pathname.split('/')[2],current=links.find(x=>x.key===section);const {user,profile,isAdmin}=useAuth();const appFrame=useAppFrame(appWebView);const {theme,resolvedTheme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const [busy,setBusy]=useState(false),[error,setError]=useState(''),[menuOpen,setMenuOpen]=useState(false);
 const multi=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1',school=multi?platformAdminSchool(pathname,params.get('section')):null;
 const schoolSection=schoolAdminSections.find(item=>item.id===school?.section);
 const navigationKey=pathname+'?'+params.toString();
 useEffect(()=>setMenuOpen(false),[navigationKey]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const el=event.target as HTMLElement;if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!el.isContentEditable&&!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)){event.preventDefault();window.dispatchEvent(new Event('admin:search-list'));}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 async function logout(){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/portal/session',{cache:'no-store'});if(r.ok){const session=await r.json();const out=await fetch('/portal/api/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:'{}'});if(!out.ok)throw Error('Sign-out failed.')}await supabase.auth.signOut({scope:'local'});window.location.replace('/')}catch{setError('Could not sign out. Please try again.');setBusy(false)}}
 // 앱 웹뷰(서버가 UA의 '; wv)'로 판별)와 폰 전용 화면(/admin/m)은 사이드바 대신 앱 상단바·하단 탭 틀을 쓴다.
 if(appFrame||pathname==='/admin/m'||pathname.startsWith('/admin/m/'))return <AppAdminFrame>{children}</AppAdminFrame>;
 const platformKeys=new Set(['schools','school-applications','feature-requests','message-reports','accounts','ad-revenue','careers']);
 const platformLinks=links.filter(item=>platformKeys.has(item.key)),legacyLinks=links.filter(item=>!platformKeys.has(item.key));
 const navLink=({href,key,label,Icon}:typeof links[number])=><Link key={key} href={href} aria-current={!school&&section===key?'page':undefined} className={'nav-item'+(!school&&section===key?' active':'')}><Icon className="icon" strokeWidth={1.6}/><span>{key==='accounts'?'Platform accounts':label}</span></Link>;
 return <div className={'admin-developer-shell'+(multi?' cb-platform-admin-shell':'')} data-theme={mounted?resolvedTheme:undefined}>
  <div className="portal">
   <aside className="sidebar" aria-label="Admin sidebar" data-menu-open={menuOpen}>
    <div className="cb-admin-sidebar-brand"><Link href={multi?'/admin/schools':'/admin'} className="brand" aria-label="CBGPU Admin overview"><CBGPULogo alt="" width={30} height={30}/><span className="brand-word">CBGPU<small>Admin</small></span></Link><button type="button" className="cb-admin-menu-toggle" onClick={()=>setMenuOpen(value=>!value)} aria-expanded={menuOpen} aria-controls="platform-admin-navigation" aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button></div>
    {multi&&isAdmin&&<PlatformSchoolPicker schoolId={school?.schoolId} section={school?.section}/>}
    <div id="platform-admin-navigation" className="cb-admin-navigation-panel">
     {school&&<><p className="nav-caption">Selected school</p><nav className="navigation" aria-label="Selected school tools">{schoolAdminSections.map(item=><Link key={item.id} href={platformSchoolAdminHref(school.schoolId,item.id)} aria-current={school.section===item.id?'page':undefined} className={'nav-item'+(school.section===item.id?' active':'')}><span className="cb-admin-nav-icon">{item.id==='members'?<Users size={18}/>:item.id==='gpu'?<Cpu size={18}/>:<Settings size={18}/>}</span><span>{item.label}</span></Link>)}</nav></>}
     {multi?<><details className="cb-admin-nav-group" open={!school}><summary><ShieldCheck size={16}/><span>Platform tools</span><ChevronDown size={15}/></summary><nav className="navigation" aria-label="Platform tools">{platformLinks.map(navLink)}</nav></details><details className="cb-admin-nav-group" open={!school&&legacyLinks.some(item=>item.key===section)}><summary><SchoolIcon/><span>Legacy operations</span><ChevronDown size={15}/></summary><p className="cb-admin-scope-note">These existing operational tools retain their original scope. They do not follow the school selector.</p><nav className="navigation" aria-label="Original school tools">{legacyLinks.map(navLink)}</nav></details></>:<nav className="navigation" aria-label="Admin tools">{links.map(navLink)}</nav>}
    </div>
    <div className="sidebar-bottom"><div className="account-summary"><p>{profile?.full_name||user?.email||'Administrator'}</p><p className="meta">{user?.email}</p></div><a href="https://cbgpu.com" target="_blank" rel="noopener noreferrer">Open cbgpu.com<ArrowUpRight className="icon"/></a><button type="button" className="button ghost" onClick={logout} disabled={busy}>{busy?'Signing out…':'Sign out'}</button></div>
   </aside>
   <div className="workspace"><header className="workspace-header"><div className="breadcrumbs"><span>CBGPU Admin</span><span className="breadcrumb-divider">/</span><strong>{school?schoolSection?.label||'School overview':section==='accounts'?'Platform accounts':current?.label||'Administration'}</strong></div><div className="header-actions"><button type="button" className="account-button" aria-label="Platform account management" onClick={()=>router.push('/admin/accounts')}><UserCircle className="icon" strokeWidth={1.6}/><span>{profile?.full_name||'Account'}</span></button><WorkspaceThemeControl/><button type="button" className="button secondary" onClick={()=>window.location.reload()}><RefreshCw className="icon" strokeWidth={1.5}/>Refresh</button></div></header>
    <main id="main-content" tabIndex={-1}>{error&&<p role="alert" className="notice error">{error}</p>}{children}</main><footer className="workspace-footer"><span>{school?'School-scoped administration':'Platform administration'}</span><span>admin.cbgpu.com</span></footer>
   </div>
  </div>
 </div>
}
function SchoolIcon(){return <Users size={16} aria-hidden="true"/>}
