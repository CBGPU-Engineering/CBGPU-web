import 'server-only';
import {preprintsClient} from './preprintsServer';
import {StudyFailure,type StudyId} from './edusetStudent';
export async function reserveStudySubmission(owner:string,student:StudyId,date:string,period:number){
 const client=preprintsClient();const {data,error}=await client.rpc('reserve_study_submission',{p_student:String(student),p_date:date,p_period:period,p_owner:owner});
 if(error)throw new StudyFailure('중복 신청 방지 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',503);
 if(!data)return null;
 return {mark:async(state:'submitting'|'confirmed'|'released'|'rejected'|'uncertain')=>{
  const {data:updated,error}=await client.from('study_submission_claims').update({state,updated_at:new Date().toISOString()}).eq('lease_token',data).eq('user_id',owner).neq('state','released').select('lease_token');
  if(error||updated?.length!==1)throw new StudyFailure('신청 처리 상태를 확인하지 못했습니다. 내 신청을 새로고침해 주세요.',503);
 }};
}
export async function releaseStudyPeriod(student:StudyId,date:string,period:number){
 const {error}=await preprintsClient().from('study_submission_claims').update({state:'released',updated_at:new Date().toISOString()}).eq('student_id',String(student)).eq('study_date',date).eq('period',period);
 if(error)throw new StudyFailure('취소는 반영됐지만 처리 상태 확인이 필요합니다. 새로고침해 주세요.',503);
}
