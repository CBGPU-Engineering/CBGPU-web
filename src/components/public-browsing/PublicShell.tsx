'use client';
import type{ReactNode}from'react';
import Link from'next/link';
import{usePathname}from'next/navigation';
import{safeAuthReturn}from'@/lib/authReturn';
import{useAuth}from'@/lib/useAuth';
import CBGPULogo from'@/components/CBGPULogo';
import WorkspaceShell from'@/components/workspaces/WorkspaceShell';
import type{WorkspaceId}from'@/lib/workspaces';
import'./public-browsing.css';
export default function PublicShell({children,workspace,isApp,sessionHint=false}:{children:ReactNode;workspace:WorkspaceId;isApp:boolean;sessionHint?:boolean}){const{user,isLoading}=useAuth(),pathname=usePathname(),returnTo=safeAuthReturn(pathname);if(user||isLoading&&sessionHint)return <WorkspaceShell workspace={workspace} isApp={isApp}>{children}</WorkspaceShell>;return <div className="cb-public-shell"><header className="cb-public-header"><Link href="/" aria-label="CBGPU 홈"><CBGPULogo variant="horizontal" width={120} height={30} priority/></Link><nav aria-label="공개 서비스"><Link href="/projects" aria-current={pathname==='/projects'||pathname.startsWith('/projects/')?'page':undefined}>프로젝트</Link><Link href="/explore/contests" aria-current={pathname==='/explore/contests'||pathname.startsWith('/explore/contests/')?'page':undefined}>대회</Link><Link href="/community" aria-current={pathname==='/community'?'page':undefined}>커뮤니티</Link><Link href="/explore/schools" aria-current={pathname.startsWith('/explore/schools')||pathname==='/schools'?'page':undefined}>학교</Link></nav><div className="cb-public-account"><a href={'/auth/login?next='+encodeURIComponent(returnTo)}>로그인</a><a href={'/auth/signup?next='+encodeURIComponent(returnTo)}>회원가입</a></div></header><main id="main-content" tabIndex={-1}>{children}</main><footer className="cb-public-footer"><CBGPULogo variant="horizontal" width={100} height={25}/><div><Link href="/docs">사용 가이드</Link><Link href="/contact">문의</Link><Link href="/privacy">개인정보처리방침</Link></div></footer></div>}
