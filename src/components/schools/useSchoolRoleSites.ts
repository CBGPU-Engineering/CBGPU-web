'use client';
import {useAuth} from '@/lib/useAuth';
import {useSchoolScope} from './SchoolScope';
import {schoolManagerMemberships,schoolManagerHome} from '@/lib/schoolAdministration';

/** Account-bound navigation; API authorization remains server-side. */
export function useSchoolRoleSites(){
 const {user,roleSites}=useAuth(),scope=useSchoolScope();
 const school=user&&scope.status==='ready'?schoolManagerMemberships(scope.memberships,user.id).find(item=>item.school_id===scope.school?.id):undefined;
 return [
  ...(school?[{id:'admin' as const,label:'관리',sub:'우리 학교 구성원 · GPU 예약 · 학교 설정',host:'app.cbgpu.com',path:schoolManagerHome(school)}]:[]),
  ...roleSites.filter(item=>item.id!=='admin'),
 ];
}
