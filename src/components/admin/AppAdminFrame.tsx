'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import {Cpu,Server,Users,Printer,Files,KeyRound,CalendarDays,Vote,UserPlus,LayoutDashboard,Briefcase,Music} from 'lucide-react';
import AppSpaceFrame,{type SpaceNavItem} from './AppSpaceFrame';
/** 관리 공간(admin.cbgpu.com)의 앱 틀. /admin/wakeup은 기상송 공간으로 따로 보여 준다. */
const adminNav:SpaceNavItem[]=[
 {id:'m',href:'/admin/m',label:'요약',Icon:LayoutDashboard},
 {id:'m:signups',href:'/admin/m?tab=signups',label:'가입 승인',Icon:UserPlus},
 {id:'m:gpu',href:'/admin/m?tab=gpu',label:'GPU 예약',Icon:Cpu},
 {id:'server',href:'/admin/server',label:'서버 배포',Icon:Server},
 {id:'accounts',href:'/admin/accounts',label:'계정',Icon:Users},
 {id:'careers',href:'/admin/careers',label:'Careers',Icon:Briefcase},
 {id:'manufacture',href:'/admin/manufacture',label:'장비 담당자',Icon:Printer},
 {id:'materials',href:'/admin/materials',label:'파일 저장',Icon:Files},
 {id:'study',href:'/admin/study',label:'자습 설정',Icon:KeyRound},
 {id:'timetable',href:'/admin/timetable',label:'시간표',Icon:CalendarDays},
 {id:'polls',href:'/admin/polls',label:'투표',Icon:Vote},
 {id:'manufacturing',href:'/admin/manufacturing',label:'제작 현황',Icon:Printer},
];
const wakeupNav:SpaceNavItem[]=[{id:'wakeup',href:'/admin/wakeup',label:'기상송',Icon:Music}];
export default function AppAdminFrame({children}:{children:React.ReactNode}){
 const pathname=usePathname(),params=useSearchParams(),tab=params.get('tab');
 if(pathname==='/admin/wakeup'||pathname.startsWith('/admin/wakeup/'))return <AppSpaceFrame current="wakeup" nav={wakeupNav} activeId="wakeup">{children}</AppSpaceFrame>;
 const isM=pathname==='/admin/m'||pathname.startsWith('/admin/m/');
 const activeId=isM?(tab==='signups'?'m:signups':tab==='gpu'?'m:gpu':'m'):(pathname==='/admin'?'gpu':pathname.split('/')[2]);
 return <AppSpaceFrame current="admin" nav={adminNav} activeId={activeId}>{children}</AppSpaceFrame>;
}
