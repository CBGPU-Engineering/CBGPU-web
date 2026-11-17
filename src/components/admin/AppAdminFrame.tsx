'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import {Cpu,Server,Users,Printer,Files,KeyRound,CalendarDays,Vote,UserPlus,LayoutDashboard,Briefcase,Music} from 'lucide-react';
import AppSpaceFrame,{type SpaceNavItem} from './AppSpaceFrame';
/** 관리 공간(admin.cbgpu.com)의 앱 틀. /admin/wakeup은 기상송 공간으로 따로 보여 준다. */
const adminNav:SpaceNavItem[]=[
 {id:'m',href:'/admin/m',label:'Overview',Icon:LayoutDashboard},
 {id:'m:signups',href:'/admin/m?tab=signups',label:'Membership reviews',Icon:UserPlus},
 {id:'m:gpu',href:'/admin/m?tab=gpu',label:'GPU reservations',Icon:Cpu},
 {id:'server',href:'/admin/server',label:'Server deployments',Icon:Server},
 {id:'accounts',href:'/admin/accounts',label:'Accounts',Icon:Users},
 ...(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?[{id:'schools',href:'/admin/schools',label:'School applications',Icon:Users}]:[]),
 {id:'careers',href:'/admin/careers',label:'Careers',Icon:Briefcase},
 {id:'manufacture',href:'/admin/manufacture',label:'Equipment managers',Icon:Printer},
 {id:'materials',href:'/admin/materials',label:'File storage',Icon:Files},
 {id:'study',href:'/admin/study',label:'Study settings',Icon:KeyRound},
 {id:'timetable',href:'/admin/timetable',label:'Timetable',Icon:CalendarDays},
 {id:'polls',href:'/admin/polls',label:'Polls',Icon:Vote},
 {id:'manufacturing',href:'/admin/manufacturing',label:'Fabrication status',Icon:Printer},
];
const wakeupNav:SpaceNavItem[]=[{id:'wakeup',href:'/admin/wakeup',label:'Wake-up music',Icon:Music}];
export default function AppAdminFrame({children}:{children:React.ReactNode}){
 const pathname=usePathname(),params=useSearchParams(),tab=params.get('tab');
 if(pathname==='/admin/wakeup'||pathname.startsWith('/admin/wakeup/'))return <AppSpaceFrame current="wakeup" nav={wakeupNav} activeId="wakeup">{children}</AppSpaceFrame>;
 const isM=pathname==='/admin/m'||pathname.startsWith('/admin/m/');
 const activeId=isM?(tab==='signups'?'m:signups':tab==='gpu'?'m:gpu':'m'):(pathname==='/admin'?'gpu':pathname.split('/')[2]);
 return <AppSpaceFrame current="admin" nav={adminNav} activeId={activeId}>{children}</AppSpaceFrame>;
}
