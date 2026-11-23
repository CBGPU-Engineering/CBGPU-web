'use client';
import SchoolAdminContext from './SchoolAdminContext';
import CBGPULogo from '@/components/CBGPULogo';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {useTheme} from 'next-themes';
import {Users,Settings,Server,ArrowLeft} from 'lucide-react';
import {WorkspaceThemeControl} from '@/components/publications/WorkspaceTheme';
import {useAuth} from '@/lib/useAuth';
import {useSchoolScope} from './SchoolScope';
import {schoolAdminSections} from '@/lib/schoolAdministration';
import {useAppFrame} from '@/lib/useAppFrame';
import AppSpaceFrame from '@/components/admin/AppSpaceFrame';
import '@/components/admin/developer-shell.css';
import '@/components/admin/admin-content.css';
/** Chrome only. Scoped APIs authorize every operation independently. */
export default function ScopedSchoolAdminShell({children,appWebView=false}:{children:ReactNode;appWebView?:boolean}){
 const path=usePathname(),section=useSearchParams().get('section')||'overview',{user,profile}=useAuth(),scope=useSchoolScope(),{resolvedTheme}=useTheme(),app=useAppFrame(appWebView),[mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 const schoolId=path.match(/^\/schools\/([-A-Za-z0-9_]{1,100})\/admin$/)?.[1];
 const member=scope.memberships.find(item=>item.user_id===user?.id&&item.school_id===schoolId&&item.verified&&item.status==='ACTIVE'&&item.school.status==='APPROVED');
 const full=member?.school_roles.some(role=>role==='SCHOOL_ADMIN'||role==='SCHOOL_OWNER');
 const sections=schoolId?schoolAdminSections.filter(item=>full||member?.school_roles.includes('GPU_ADMIN')&&['gpu','gpu-reservations'].includes(item.id)):[];
 const nav=sections.map(item=>({id:item.id,label:item.label,href:path+'?section='+item.id,Icon:item.id.startsWith('gpu')?Server:item.id==='members'?Users:Settings}));
 if(app)return <div className="cb-school-scoped-shell"><AppSpaceFrame current="admin" nav={nav} activeId={section}><SchoolAdminContext/>{children}</AppSpaceFrame></div>;
 return <div className="admin-developer-shell cb-school-scoped-shell" data-theme={mounted?resolvedTheme:undefined}><div className="portal"><aside className="sidebar" aria-label="학교 관리자 메뉴"><Link href="/school-admin" className="brand"><CBGPULogo width={30} height={30} alt=""/><span className="brand-word">CBGPU<small>학교 관리자</small></span></Link><SchoolAdminContext/><nav className="navigation min-h-0 flex-1 overflow-y-auto">{nav.map(item=><Link key={item.id} href={item.href} aria-current={section===item.id?'page':undefined} className={'nav-item'+(section===item.id?' active':'')}><item.Icon className="icon"/>{item.label}</Link>)}</nav><div className="sidebar-bottom"><div className="account-summary"><p>{profile?.full_name||'CBGPU 계정'}</p><p className="meta">{user?.email}</p></div><Link href="/schools"><ArrowLeft className="icon"/> 학교 목록</Link></div></aside><div className="workspace"><header className="workspace-header"><div className="breadcrumbs"><span>CBGPU</span><span className="breadcrumb-divider">/</span><strong>학교 관리자</strong></div><WorkspaceThemeControl korean/></header><main id="main-content" tabIndex={-1}>{children}</main><footer className="workspace-footer"><span>선택한 학교의 관리 도구</span><span>CBGPU</span></footer></div></div></div>;
}
