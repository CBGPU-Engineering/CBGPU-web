'use client';

import {useEffect} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/lib/useAuth';
import {useSchoolScope} from './SchoolScope';
import {schoolManagerMemberships,schoolManagerHome} from '@/lib/schoolAdministration';
import {Button} from '@/components/ui/button';

/** A navigation convenience only. Every destination API rechecks school authorization. */
export default function SchoolAdminEntry(){
 const {user}=useAuth(),scope=useSchoolScope(),router=useRouter();
 const memberships=user?schoolManagerMemberships(scope.memberships,user.id):[];
 const selected=memberships.find(item=>item.school_id===scope.school?.id);
 const destination=selected??(memberships.length===1?memberships[0]:undefined);
 useEffect(()=>{if(scope.status==='ready'||scope.status==='none'){if(destination)router.replace(schoolManagerHome(destination));}},[scope.status,destination?.school_id,router]);
 if(scope.status==='loading'||destination)return <section className="cb-school-page" role="status"><h1>학교 관리자 화면을 여는 중이에요</h1><p>계정의 학교 관리 권한을 확인하고 있어요.</p></section>;
 if(scope.status==='unavailable')return <section className="cb-school-page"><h1>학교를 확인하지 못했어요</h1><p role="alert">잠시 후 다시 시도해 주세요.</p><Button onClick={()=>void scope.refresh()}>다시 확인하기</Button></section>;
 if(!memberships.length)return <section className="cb-school-page"><h1>학교 관리자 전용 페이지예요</h1><p>승인된 학교 관리 계정으로 로그인해 주세요. 일반 회원이나 플랫폼 관리자 권한만으로는 학교를 관리할 수 없어요.</p><Link href="/schools">학교 목록 보기</Link></section>;
 return <section className="cb-school-page"><h1>관리할 학교를 선택해 주세요</h1><p>관리 권한이 있는 학교만 표시해요.</p><ul className="space-y-3">{memberships.map(item=><li key={item.id}><Link className="flex min-h-11 items-center rounded-xl border border-border bg-card px-4 py-3 font-medium" href={schoolManagerHome(item)}>{item.school.display_name||item.school.official_name}</Link></li>)}</ul></section>;
}
