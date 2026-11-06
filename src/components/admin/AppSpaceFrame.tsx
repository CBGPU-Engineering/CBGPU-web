'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {DropdownMenu as ModeMenu} from 'radix-ui';
import {useTheme} from 'next-themes';
import {Check,ChevronDown,RefreshCw,GraduationCap,FlaskConical,ShieldCheck,Printer,Music,Moon,Sun} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {siteHref} from '@/lib/siteHref';
import {workspaces} from '@/lib/workspaces';
import '@/components/workspaces/workspaces.css';
import '@/components/workspaces/audience-design.css';
import '@/components/workspaces/app-layout.css';
/**
 * 앱(웹뷰)에서 여는 관리·제작·기상송 화면의 공통 틀. 학교생활·연구개발과 같은 상단바(공간 전환 메뉴)와 하단 탭을 쓰고,
 * 가운데에는 기존 페이지를 그대로 보여 준다. 공간 메뉴는 "학교생활 · 연구·개발" 아래에 내 역할에 맞는 관리 → 제작 → 기상송이 이어진다.
 * 하단 탭은 모든 메뉴를 담고 가로로 스크롤된다.
 */
export type SpaceId='admin'|'manufacturing'|'wakeup';
export type SpaceNavItem={id:string;href:string;label:string;Icon:LucideIcon};
const spaces=[{id:'student',label:'학교생활',sub:'자습 · 시간표 · 급식 · 자료 공유',Icon:GraduationCap},{id:'researcher',label:'연구·개발',sub:'GPU · 웹사이트 배포 · 논문 · 제작',Icon:FlaskConical}] as const;
const roleIcons={admin:ShieldCheck,manufacturing:Printer,wakeup:Music};
const appHome=(id:string)=>siteHref(`https://app.cbgpu.com/?mode=${id}`);
export default function AppSpaceFrame({current,nav,activeId,children}:{current:SpaceId;nav:SpaceNavItem[];activeId:string;children:React.ReactNode}){
 const {resolvedTheme,setTheme}=useTheme(),{roleSites}=useAuth(),navRef=useRef<HTMLElement>(null);
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 const currentSite=roleSites.find(site=>site.id===current),currentLabel=currentSite?.label||{admin:'관리',manufacturing:'제작',wakeup:'기상송'}[current];
 useEffect(()=>{navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({inline:'center',block:'nearest'})},[activeId]);
 return <div className="cb-workspace cb-app" style={{'--workspace-accent':'var(--primary)'} as React.CSSProperties}>
  <div className="cb-workspace-body">
   <header className="cb-workspace-header cb-app-header">
    <a href={appHome('student')} className="cb-app-brand" aria-label="CBGPU 앱 홈"><Image src="/img/cbgpu-logo.png" width={34} height={34} alt="CBGPU"/></a>
    <ModeMenu.Root>
     <ModeMenu.Trigger asChild><button className="cb-app-mode-trigger" aria-label="CBGPU 공간 선택" data-current-mode={current}><span><small>CBGPU</small><strong>{currentLabel}</strong></span><ChevronDown size={14}/></button></ModeMenu.Trigger>
     <ModeMenu.Portal><ModeMenu.Content className="cb-app-mode-menu" align="center" sideOffset={12} collisionPadding={12}>
      <div className="cb-mode-menu-heading"><strong>어떤 공간에서 시작할까요?</strong><span>같은 계정으로 자유롭게 바꿀 수 있어요.</span></div>
      <ModeMenu.RadioGroup value={current}>
       {spaces.map(({id,label,sub,Icon})=><ModeMenu.RadioItem key={id} value={id} onSelect={()=>window.location.assign(appHome(id))} className="cb-app-mode-option"><span className="cb-mode-option-icon" style={{color:workspaces[id].accent}}><Icon size={21}/></span><span><strong>{label}</strong><small>{sub}</small></span></ModeMenu.RadioItem>)}
       {roleSites.map(site=>{const Icon=roleIcons[site.id];return <ModeMenu.RadioItem key={site.id} value={site.id} onSelect={()=>{if(site.id!==current)window.location.assign(siteHref(`https://${site.host}${site.path}?from=app`))}} className="cb-app-mode-option"><span className="cb-mode-option-icon" style={{color:'var(--primary)'}}><Icon size={21}/></span><span><strong>{site.label}</strong><small>{site.sub}</small></span><ModeMenu.ItemIndicator><Check size={17}/></ModeMenu.ItemIndicator></ModeMenu.RadioItem>})}
      </ModeMenu.RadioGroup>
      <ModeMenu.Separator className="cb-mode-menu-divider"/>
      <ModeMenu.Item aria-label="화면 테마 전환" className="cb-mode-menu-theme" onSelect={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>{resolvedTheme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{resolvedTheme==='dark'?'라이트 모드로 전환':'다크 모드로 전환'}</span></ModeMenu.Item>
     </ModeMenu.Content></ModeMenu.Portal>
    </ModeMenu.Root>
    <div className="cb-header-actions"><button aria-label="새로고침" onClick={()=>window.location.reload()}><RefreshCw size={19}/></button></div>
   </header>
   <div className="admin-developer-shell cb-admin-app-body" data-theme={mounted?resolvedTheme:undefined} style={{paddingBottom:nav.length>1?'calc(96px + env(safe-area-inset-bottom))':'32px'}}>
    <div className="portal"><div className="workspace"><main id="main-content" tabIndex={-1}>{children}</main></div></div>
   </div>
  </div>
  {nav.length>1&&<nav ref={navRef} className="cb-bottom-nav cb-admin-nav" aria-label={currentLabel+' 메뉴'}>{nav.map(({id,href,label,Icon})=><Link key={id} href={href} className={activeId===id?'active':''} aria-current={activeId===id?'page':undefined}><Icon size={20}/><span>{label}</span></Link>)}</nav>}
 </div>;
}
