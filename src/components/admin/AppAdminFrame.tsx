'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname,useSearchParams} from 'next/navigation';
import {DropdownMenu as ModeMenu} from 'radix-ui';
import {useTheme} from 'next-themes';
import {Check,ChevronDown,Cpu,Server,Users,Printer,Files,KeyRound,Music,CalendarDays,Vote,UserPlus,LayoutDashboard,Briefcase,RefreshCw,GraduationCap,FlaskConical,ShieldCheck,Moon,Sun} from 'lucide-react';
import {siteHref} from '@/lib/siteHref';
import {workspaces} from '@/lib/workspaces';
import '@/components/workspaces/workspaces.css';
import '@/components/workspaces/audience-design.css';
import '@/components/workspaces/app-layout.css';
/**
 * 앱(웹뷰)에서 여는 관리 화면의 틀. 학교생활·연구개발과 같은 상단바(공간 전환 메뉴에 "관리" 포함)와 하단 탭을 쓰고,
 * 가운데에는 기존 관리자 페이지를 그대로 보여 준다. 하단 탭은 모든 관리 메뉴를 담고 가로로 스크롤된다.
 */
const nav=[
 {id:'m',href:'/admin/m',label:'요약',Icon:LayoutDashboard},
 {id:'m:signups',href:'/admin/m?tab=signups',label:'가입 승인',Icon:UserPlus},
 {id:'m:gpu',href:'/admin/m?tab=gpu',label:'GPU 예약',Icon:Cpu},
 {id:'server',href:'/admin/server',label:'서버 배포',Icon:Server},
 {id:'accounts',href:'/admin/accounts',label:'계정',Icon:Users},
 {id:'careers',href:'/admin/careers',label:'Careers',Icon:Briefcase},
 {id:'manufacture',href:'/admin/manufacture',label:'장비 담당자',Icon:Printer},
 {id:'materials',href:'/admin/materials',label:'파일 저장',Icon:Files},
 {id:'study',href:'/admin/study',label:'자습 설정',Icon:KeyRound},
 {id:'wakeup',href:'/admin/wakeup',label:'기상송',Icon:Music},
 {id:'timetable',href:'/admin/timetable',label:'시간표',Icon:CalendarDays},
 {id:'polls',href:'/admin/polls',label:'투표',Icon:Vote},
 {id:'manufacturing',href:'/admin/manufacturing',label:'제작',Icon:Printer},
];
const spaces=[{id:'student',label:'학교생활',sub:'자습 · 시간표 · 급식 · 자료 공유',Icon:GraduationCap},{id:'researcher',label:'연구·개발',sub:'GPU · 웹사이트 배포 · 논문 · 제작',Icon:FlaskConical}];
const appHome=(id:string)=>siteHref(`https://app.cbgpu.com/?mode=${id}`);
export default function AppAdminFrame({children}:{children:React.ReactNode}){
 const pathname=usePathname(),params=useSearchParams(),{resolvedTheme,setTheme}=useTheme(),navRef=useRef<HTMLElement>(null);
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 const isM=pathname==='/admin/m'||pathname.startsWith('/admin/m/'),tab=params.get('tab');
 const activeId=isM?(tab==='signups'?'m:signups':tab==='gpu'?'m:gpu':'m'):(pathname==='/admin'?'gpu':pathname.split('/')[2]);
 useEffect(()=>{navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({inline:'center',block:'nearest'})},[activeId]);
 return <div className="cb-workspace cb-app" style={{'--workspace-accent':'var(--primary)'} as React.CSSProperties}>
  <div className="cb-workspace-body">
   <header className="cb-workspace-header cb-app-header">
    <a href={appHome('student')} className="cb-app-brand" aria-label="CBGPU 앱 홈"><Image src="/img/cbgpu-logo.png" width={34} height={34} alt="CBGPU"/></a>
    <ModeMenu.Root>
     <ModeMenu.Trigger asChild><button className="cb-app-mode-trigger" aria-label="CBGPU 공간 선택" data-current-mode="admin"><span><small>CBGPU</small><strong>관리</strong></span><ChevronDown size={14}/></button></ModeMenu.Trigger>
     <ModeMenu.Portal><ModeMenu.Content className="cb-app-mode-menu" align="center" sideOffset={12} collisionPadding={12}>
      <div className="cb-mode-menu-heading"><strong>어떤 공간에서 시작할까요?</strong><span>같은 계정으로 자유롭게 바꿀 수 있어요.</span></div>
      <ModeMenu.RadioGroup value="admin">
       {spaces.map(({id,label,sub,Icon})=><ModeMenu.RadioItem key={id} value={id} onSelect={()=>window.location.assign(appHome(id))} className="cb-app-mode-option"><span className="cb-mode-option-icon" style={{color:workspaces[id as 'student'|'researcher'].accent}}><Icon size={21}/></span><span><strong>{label}</strong><small>{sub}</small></span></ModeMenu.RadioItem>)}
       <ModeMenu.RadioItem value="admin" className="cb-app-mode-option"><span className="cb-mode-option-icon" style={{color:'var(--primary)'}}><ShieldCheck size={21}/></span><span><strong>관리</strong><small>가입 승인 · GPU 예약 · 서버 · 계정</small></span><ModeMenu.ItemIndicator><Check size={17}/></ModeMenu.ItemIndicator></ModeMenu.RadioItem>
      </ModeMenu.RadioGroup>
      <ModeMenu.Separator className="cb-mode-menu-divider"/>
      <ModeMenu.Item aria-label="화면 테마 전환" className="cb-mode-menu-theme" onSelect={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>{resolvedTheme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{resolvedTheme==='dark'?'라이트 모드로 전환':'다크 모드로 전환'}</span></ModeMenu.Item>
     </ModeMenu.Content></ModeMenu.Portal>
    </ModeMenu.Root>
    <div className="cb-header-actions"><button aria-label="새로고침" onClick={()=>window.location.reload()}><RefreshCw size={19}/></button></div>
   </header>
   <div className="admin-developer-shell cb-admin-app-body" data-theme={mounted?resolvedTheme:undefined} style={{paddingBottom:'calc(96px + env(safe-area-inset-bottom))'}}>
    <div className="portal"><div className="workspace"><main id="main-content" tabIndex={-1}>{children}</main></div></div>
   </div>
  </div>
  <nav ref={navRef} className="cb-bottom-nav cb-admin-nav" aria-label="관리 메뉴">{nav.map(({id,href,label,Icon})=><Link key={id} href={href} className={activeId===id?'active':''} aria-current={activeId===id?'page':undefined}><Icon size={20}/><span>{label}</span></Link>)}</nav>
 </div>;
}
