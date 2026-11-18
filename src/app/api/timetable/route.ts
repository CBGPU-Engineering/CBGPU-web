import { NextRequest, NextResponse } from 'next/server';
import{getNeisSheetTimetable,neisSheetTargetFromSources,type NeisSheetTarget}from'@/lib/neisSheetTimetable';
import { getTimetable } from '@/lib/comcigan';
import {comciganTargetFromSources,type ComciganSchoolTarget}from'@/lib/comciganSchool';
import{schoolLifeAuthorityJson}from'@/lib/schoolLifeAuthority';
import{trustedInternalServiceUrl}from'@/lib/internalServiceUrl';
export const dynamic = 'force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization'}});
export async function GET(req: NextRequest) {
 const sp=req.nextUrl.searchParams,multi=process.env.CBGPU_MULTISCHOOL_V1==='1',schoolId=sp.get('school_id');
 const department=sp.get('department');if(department!==null&&!/^[a-f0-9]{20}$/.test(department))return reply({error:'학과·과정을 다시 선택해주세요.'},400);
 const g=sp.get('grade')||'1',c=sp.get('class')||'1',grade=Number(g),cls=Number(c);
 if(!/^[1-9]\d*$/.test(g)||!Number.isInteger(grade)||grade>(multi?12:3)||!/^[1-9]\d*$/.test(c)||!Number.isInteger(cls)||cls>(multi?100:20))return reply({error:'학년과 반을 확인해주세요.'},400);
 if(!multi&&schoolId&&schoolId!=='cbsh')return reply({error:'학교별 시간표 연결을 준비하고 있어요.'},503);
 let school:ComciganSchoolTarget|undefined,neis:NeisSheetTarget|null=null;
 if(multi){
  if(!schoolId||!/^[-a-zA-Z0-9_]{1,100}$/.test(schoolId))return reply({error:'현재 학교를 선택해주세요.'},400);
  if([...sp.keys()].some(key=>!['grade','class','refresh','school_id','department'].includes(key)))return reply({error:'시간표 요청을 확인해주세요.'},400);
  const authorization=req.headers.get('authorization');if(!authorization||!/^Bearer [^\s,]{1,8192}$/i.test(authorization))return reply({error:'로그인 후 학교 소속을 확인해주세요.'},401);
  let endpoint:URL;try{endpoint=trustedInternalServiceUrl(process.env.CBGPU_SCHOOLS_API_URL||'http://127.0.0.1:3546',process.env.CBGPU_INTERNAL_NETWORK_MODE);endpoint.pathname='/v1/schools/'+encodeURIComponent(schoolId)+'/life-sources';endpoint.search='';endpoint.hash=''}catch{return reply({error:'학교 연결 설정을 확인하고 있어요.'},503)}
  try{
   const response=await fetch(endpoint,{headers:{Authorization:authorization},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20_000)});
   if(!response.ok)return reply({error:response.status===401?'다시 로그인해 학교 소속을 확인해주세요.':response.status===403?'인증된 학교 구성원만 시간표를 볼 수 있어요.':'학교 시간표 연결을 확인하지 못했어요.'},[401,403].includes(response.status)?response.status:503);
   const sources=await schoolLifeAuthorityJson(response);neis=schoolId==='cbsh'?null:neisSheetTargetFromSources(schoolId,sources);try{school=comciganTargetFromSources(schoolId,sources)}catch(error){if(!neis)throw error}
  }catch{return reply({error:'이 학교의 시간표 연결을 준비하고 있어요. 학교 관리자에게 연결 확인을 요청해주세요.'},503)}
 }
 try{
  if(!school&&neis)return reply(await getNeisSheetTimetable(neis,grade,cls,department));
  if(department&&!neis)return reply({error:'이 시간표는 학과 선택을 제공하지 않아요.'},400);
  const result=await getTimetable(grade,cls,{forceRefresh:sp.get('refresh')==='1',...(school?{school}:{})});
  return reply({grid:result.grid,times:result.classTimes,grades:result.grades,classes:result.classes,school:result.schoolName,school_id:school?.id??'cbsh',stale:result.stale,fetchedAt:result.fetchedAt,weekStart:result.weekStart});
 }catch(error){if(neis){try{return reply(await getNeisSheetTimetable(neis,grade,cls,department))}catch{return reply({error:'학교 시간표를 확인하지 못했어요. 잠시 후 다시 조회하거나 학교에 확인해주세요.',code:'TIMETABLE_PROVIDER_ERROR',school_id:neis.id},502)}}return reply({error:error instanceof Error?error.message:'시간표를 불러오지 못했어요.',code:'TIMETABLE_PROVIDER_ERROR',school_id:school?.id??'cbsh'},502)}
}
