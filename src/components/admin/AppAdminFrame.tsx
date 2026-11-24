'use client';
import {useEffect} from 'react';
import {siteHref} from '@/lib/siteHref';
import {usePathname,useSearchParams} from 'next/navigation';
import {Cpu,Server,Users,Printer,Files,KeyRound,CalendarDays,Vote,UserPlus,LayoutDashboard,Briefcase,Music,Building2,Settings,GraduationCap,Link2,Handshake,UserCheck,Flag} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import PlatformSchoolPicker from '@/components/schools/PlatformSchoolPicker';
import {platformAdminSchool,platformSchoolAdminHref} from '@/lib/platformAdminNavigation';
import {schoolAdminSections} from '@/lib/schoolAdministration';
import AppSpaceFrame,{type SpaceNavItem} from './AppSpaceFrame';
/** 관리 공간(admin.cbgpu.com)의 앱 틀. /admin/wakeup은 기상송 공간으로 따로 보여 준다. */
const adminNav:SpaceNavItem[]=[
 ...(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?[{id:'schools',href:'/admin/schools',label:'학교',Icon:Users},{id:'school-applications',href:'/admin/school-applications',label:'학교 신청',Icon:Files}]:[]),
 {id:'m',href:'/admin/m',label:'요약',Icon:LayoutDashboard},
 {id:'m:signups',href:'/admin/m?tab=signups',label:'가입 확인',Icon:UserPlus},
 {id:'m:gpu',href:'/admin/m?tab=gpu',label:'GPU 예약',Icon:Cpu},
 {id:'server',href:'/admin/server',label:'서버 배포',Icon:Server},
 {id:'accounts',href:'/admin/accounts',label:'계정',Icon:Users},
 ...(process.env.NEXT_PUBLIC_CBGPU_AD_REVENUE_V1==='1'?[{id:'ad-revenue',href:'/admin/ad-revenue',label:'광고 수익',Icon:LayoutDashboard}]:[]),
 ...(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?[{id:'feature-requests',href:'/admin/feature-requests',label:'기능 요청',Icon:Files}]:[]),
 ...(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?[{id:'message-reports',href:'/admin/message-reports',label:'신고',Icon:Users}]:[]),
 {id:'careers',href:'/admin/careers',label:'채용 지원',Icon:Briefcase},
 {id:'manufacture',href:'/admin/manufacture',label:'장비 담당자',Icon:Printer},
 {id:'materials',href:'/admin/materials',label:'파일 저장',Icon:Files},
 {id:'study',href:'/admin/study',label:'자습 설정',Icon:KeyRound},
 {id:'timetable',href:'/admin/timetable',label:'시간표',Icon:CalendarDays},
 {id:'polls',href:'/admin/polls',label:'투표',Icon:Vote},
 {id:'manufacturing',href:'/admin/manufacturing',label:'제작 현황',Icon:Printer},
];
// 선택한 학교의 관리 메뉴(앱 하단 탭용 짧은 한글 이름).
const schoolTabs:Record<string,[string,SpaceNavItem['Icon']]>={overview:['개요',LayoutDashboard],members:['구성원',Users],features:['구성',Settings],access:['게스트',KeyRound],academic:['학년',GraduationCap],integrations:['연동',Link2],gpu:['GPU 노드',Cpu],'joint-events':['공동 행사',Handshake],affiliations:['소속 변경',UserCheck],moderation:['신고',Flag]};
const wakeupNav:SpaceNavItem[]=[{id:'wakeup',href:'/admin/wakeup',label:'기상송',Icon:Music}];
export default function AppAdminFrame({children}:{children:React.ReactNode}){
 const pathname=usePathname(),params=useSearchParams(),tab=params.get('tab'),{isAdmin}=useAuth();
 const multi=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1',school=multi?platformAdminSchool(pathname,params.get('section')):null;
 const schoolEntry=multi&&pathname!=='/admin/wakeup'&&!pathname.startsWith('/admin/wakeup/');
 useEffect(()=>{if(schoolEntry)window.location.replace(siteHref('https://app.cbgpu.com/school-admin?from=app'));},[schoolEntry]);
 if(schoolEntry)return <p role="status" className="p-6">학교 관리자 화면으로 이동하고 있어요.</p>;
 if(pathname==='/admin/wakeup'||pathname.startsWith('/admin/wakeup/'))return <AppSpaceFrame current="wakeup" nav={wakeupNav} activeId="wakeup">{children}</AppSpaceFrame>;
 const isM=pathname==='/admin/m'||pathname.startsWith('/admin/m/');
 const activeId=isM?(tab==='signups'?'m:signups':tab==='gpu'?'m:gpu':'m'):(pathname==='/admin'?(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?'schools':'gpu'):pathname.split('/')[2]);
 const schoolNav:SpaceNavItem[]=school?[{id:'schools',href:'/admin/schools',label:'학교 목록',Icon:Building2},...schoolAdminSections.map(item=>({id:'school:'+item.id,href:platformSchoolAdminHref(school.schoolId,item.id),label:schoolTabs[item.id]?.[0]||item.label,Icon:schoolTabs[item.id]?.[1]||LayoutDashboard}))]:[];
 const nav=school?[...schoolNav,...adminNav.filter(item=>item.id!=='schools')]:adminNav;
 return <AppSpaceFrame current="admin" nav={nav} activeId={school?'school:'+school.section:activeId}>{multi&&isAdmin&&<div className="cb-app-admin-school"><PlatformSchoolPicker schoolId={school?.schoolId} section={school?.section}/></div>}{children}</AppSpaceFrame>;
}
