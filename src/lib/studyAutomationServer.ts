import 'server-only';
import {preprintsClient} from './preprintsServer';
import {studyScopedMode} from './studyAuth';
import {handleStudentStudy,StudyFailure,type StudyContext,type StudyId} from './edusetStudent';
import {savedSchoolToken,forgetSchoolConnection} from './edusetStudentStore';
import {sendSchoolStudent} from './edusetStudentClient';
import {reserveStudySubmission,releaseStudyPeriod} from './studySubmissionStore';
/** Owner originates only from a trusted saved automation row, never a caller header/body. */
export async function requireAutomaticStudyOwner(owner:string){
 if(!studyScopedMode())return;
 if(!/^[a-f0-9-]{36}$/i.test(owner))throw new StudyFailure('자동신청 계정을 확인하지 못했습니다.',403);
 try{const {data,error}=await preprintsClient().rpc('cbgpu_service_can_use_resource',{user_id:owner,resource:'study',target_school:'cbsh'});if(error)throw new StudyFailure('자습 권한 확인 서버에 연결하지 못했습니다.',503);if(data!==true)throw new StudyFailure('자습 권한이 만료되거나 회수되었습니다.',403);}
 catch(error){if(error instanceof StudyFailure)throw error;throw new StudyFailure('자습 권한 확인 서버에 연결하지 못했습니다.',503);}
}
export async function automaticSchoolRequest(owner:string,body?:unknown){
 await requireAutomaticStudyOwner(owner);
 return handleStudentStudy(new Request('https://cbgpu.com/api/study/student',{method:body===undefined?'GET':'POST',headers:{host:'cbgpu.com',origin:'https://cbgpu.com','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{
  authorize:async()=>owner,limit:()=>true,send:async(...args)=>{await requireAutomaticStudyOwner(owner);return sendSchoolStudent(...args)},getConnection:savedSchoolToken,disconnect:forgetSchoolConnection,reserveWrite:reserveStudySubmission,releasePeriod:releaseStudyPeriod,
 });
}
export async function automaticStudyContext(owner:string):Promise<StudyContext>{const response=await automaticSchoolRequest(owner);const body=await response.json();if(!response.ok)throw new StudyFailure(body.message||'학교 계정 연결을 확인해 주세요.',response.status,body.code);return body}
export async function personalSchoolRead(owner:string,path:string,method='GET',body?:unknown){await requireAutomaticStudyOwner(owner);const token=await savedSchoolToken(owner);if(!token)throw new StudyFailure('학교 계정을 다시 연결해 주세요.',401);return sendSchoolStudent(path,token,method,body)}
export async function automationRuns(owner:string){const {data,error}=await preprintsClient().from('study_auto_runs').select('study_date,period,status,message,room_name,seat_name,started_at,finished_at').eq('user_id',owner).order('study_date',{ascending:false}).order('period',{ascending:true}).limit(24);if(error)throw new StudyFailure('자동신청 기록을 확인하지 못했습니다.',503);return data||[]}
export function sortedPeriods(values:unknown):number[]{return Array.isArray(values)?[...new Set(values.filter((v):v is number=>Number.isInteger(v)&&v>0))].sort((a,b)=>a-b):[]}
