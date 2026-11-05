import 'server-only';
import {preprintsClient} from './preprintsServer';
import {handleStudentStudy,StudyFailure,type StudyContext,type StudyId} from './edusetStudent';
import {savedSchoolToken,forgetSchoolConnection} from './edusetStudentStore';
import {sendSchoolStudent} from './edusetStudentClient';
import {reserveStudySubmission,releaseStudyPeriod} from './studySubmissionStore';
export async function automaticSchoolRequest(owner:string,body?:unknown){
 return handleStudentStudy(new Request('https://cbgpu.com/api/study/student',{method:body===undefined?'GET':'POST',headers:{host:'cbgpu.com',origin:'https://cbgpu.com','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{
  authorize:async()=>owner,limit:()=>true,send:sendSchoolStudent,getConnection:savedSchoolToken,disconnect:forgetSchoolConnection,reserveWrite:reserveStudySubmission,releasePeriod:releaseStudyPeriod,
 });
}
export async function automaticStudyContext(owner:string):Promise<StudyContext>{const response=await automaticSchoolRequest(owner);const body=await response.json();if(!response.ok)throw new StudyFailure(body.message||'학교 계정 연결을 확인해 주세요.',response.status,body.code);return body}
export async function personalSchoolRead(owner:string,path:string,method='GET',body?:unknown){const token=await savedSchoolToken(owner);if(!token)throw new StudyFailure('학교 계정을 다시 연결해 주세요.',401);return sendSchoolStudent(path,token,method,body)}
export async function automationRuns(owner:string){const {data,error}=await preprintsClient().from('study_auto_runs').select('study_date,period,status,message,room_name,seat_name,started_at,finished_at').eq('user_id',owner).order('study_date',{ascending:false}).order('period',{ascending:true}).limit(24);if(error)throw new StudyFailure('자동신청 기록을 확인하지 못했습니다.',503);return data||[]}
export function sortedPeriods(values:unknown):number[]{return Array.isArray(values)?[...new Set(values.filter((v):v is number=>Number.isInteger(v)&&v>0))].sort((a,b)=>a-b):[]}
