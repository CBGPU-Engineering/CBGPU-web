'use client';
import CBGPULogo from '@/components/CBGPULogo';
import type {ReactNode} from 'react';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {useTheme} from 'next-themes';
import {Users,Settings,Server,ArrowLeft} from 'lucide-react';
import {WorkspaceThemeControl} from '@/components/publications/WorkspaceTheme';
import {useAuth} from '@/lib/useAuth';
import '@/components/admin/developer-shell.css';
import '@/components/admin/admin-content.css';
/** Chrome only. Scoped Rust APIs authorize every school operation independently. */
export default function ScopedSchoolAdminShell({children}:{children:ReactNode}){const path=usePathname(),section=useSearchParams().get('section')||'members',{user,profile}=useAuth(),{resolvedTheme}=useTheme(),[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return <div className="admin-developer-shell cb-school-scoped-shell" data-theme={mounted?resolvedTheme:undefined}><div className="portal"><aside className="sidebar" aria-label="School administration sidebar"><Link href={path} className="brand"><CBGPULogo  width={30} height={30} alt=""/><span className="brand-word">CBGPU<small>School administration</small></span></Link><p className="nav-caption">This school</p><nav className="navigation">{([{id:'members',label:'Members',Icon:Users},{id:'features',label:'Configuration',Icon:Settings},{id:'gpu',label:'GPU nodes',Icon:Server},{id:'access',label:'Guest access',Icon:Users},{id:'academic',label:'Academic year',Icon:Users},{id:'integrations',label:'Integrations',Icon:Settings}]as const).map(item=><Link key={item.id} href={path+'?section='+item.id} aria-current={section===item.id?'page':undefined} className={'nav-item'+(section===item.id?' active':'')}><item.Icon className="icon"/>{item.label}</Link>)}</nav><div className="sidebar-bottom"><div className="account-summary"><p>{profile?.full_name||'CBGPU account'}</p><p className="meta">{user?.email}</p></div><Link href="/schools"><ArrowLeft className="icon"/> School directory</Link></div></aside><div className="workspace"><header className="workspace-header"><div className="breadcrumbs"><span>CBGPU</span><span className="breadcrumb-divider">/</span><strong>School administration</strong></div><WorkspaceThemeControl/></header><main id="main-content" tabIndex={-1}>{children}</main><footer className="workspace-footer"><span>School-scoped access</span><span>CBGPU</span></footer></div></div></div>}
