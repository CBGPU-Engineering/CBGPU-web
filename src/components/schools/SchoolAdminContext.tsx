'use client';
import {Dropdown} from '@/components/ui/dropdown';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/useAuth';
import {useSchoolScope} from './SchoolScope';
import {schoolManagerMemberships,schoolManagerHome,schoolAdminHref} from '@/lib/schoolAdministration';
import './school-admin-hub.css';
/** Route-bound scope. Switching workspaces never changes personal school preference. */
export default function SchoolAdminContext(){
 const path=usePathname(),schoolId=path.match(/^\/schools\/([-A-Za-z0-9_]{1,100})\/admin$/)?.[1],{user}=useAuth(),scope=useSchoolScope(),router=useRouter(),section=useSearchParams().get('section')||'overview';
 if(!schoolId)return null;
 const items=user?schoolManagerMemberships(scope.memberships,user.id):[],selected=items.find(item=>item.school_id===schoolId);
 return <section className="cb-admin-school-context" aria-label="관리 중인 학교"><span>관리 중인 학교</span><strong>{selected?.school.display_name||selected?.school.official_name||'학교 권한 확인 중'}</strong>{items.length>1&&<label><span className="sr-only">관리할 학교 선택</span><Dropdown value={schoolId} onChange={event=>{const next=items.find(item=>item.school_id===event.target.value);if(next)router.push(next.school_roles.some(role=>role==='SCHOOL_ADMIN'||role==='SCHOOL_OWNER')?schoolAdminHref(next.school_id,section):schoolManagerHome(next))}}>{!selected&&<option value={schoolId}>학교 확인</option>}{items.map(item=><option key={item.id} value={item.school_id}>{item.school.display_name||item.school.official_name}</option>)}</Dropdown></label>}{scope.status==='unavailable'&&<p role="status">학교 권한을 확인하지 못했어요. 새로고침해 주세요.</p>}<p>이 화면의 변경사항은 선택한 학교에만 적용돼요.</p></section>;
}
