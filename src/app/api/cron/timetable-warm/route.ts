import {NextRequest,NextResponse} from 'next/server';
import {timetableWarmAuthorized,timetableWarmInput,timetableWarmTarget} from '@/lib/timetableWarm';
import {trustedInternalServiceUrl} from '@/lib/internalServiceUrl';
import {boundedSchoolBody} from '@/lib/schoolsProxySecurity';
import {getTimetable} from '@/lib/comcigan';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'x-cbgpu-timetable-warm'}});
export async function POST(req:NextRequest){
 try{if(!await timetableWarmAuthorized(req.headers.get('x-cbgpu-timetable-warm'),process.env.CBGPU_TIMETABLE_WARM_SECRET_FILE))return reply({error:'Operator authentication required'},401)}catch{return reply({error:'Operator warm service unavailable'},503)}
 let input:ReturnType<typeof timetableWarmInput>;try{if(req.nextUrl.search||Number(req.headers.get('content-length')||0)>2048)throw Error();input=timetableWarmInput(JSON.parse(await boundedSchoolBody(req.body,2048)))}catch{return reply({error:'Invalid warm request'},400)}
 if(input.school_id!=='cbsh')return reply({error:'Target has not been reviewed for canonical warming',code:'UNREVIEWED_WARM_TARGET'},409);
 try{
  const endpoint=trustedInternalServiceUrl(process.env.CBGPU_SCHOOLS_API_URL||'http://127.0.0.1:3546',process.env.CBGPU_INTERNAL_NETWORK_MODE);endpoint.pathname='/v1/schools/'+encodeURIComponent(input.school_id);endpoint.search='';endpoint.hash='';
  const response=await fetch(endpoint,{headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)return reply({error:'Canonical school source unavailable'},503);
  const target=timetableWarmTarget(input.school_id,JSON.parse(await boundedSchoolBody(response.body,65536)));
  const result=await getTimetable(input.grade,input.class,{school:target,forceRefresh:true});
  const days=Object.values(result.grid),cells=days.reduce((n,day)=>n+Object.keys(day).length,0);
  if(result.stale||cells===0)return reply({error:'Fresh timetable unavailable'},503);
  // Never return the timetable, teacher names, provider URL or secret to a cron job.
  return reply({ok:true,school_id:input.school_id,days:days.length,cells,stale:false});
 }catch{return reply({error:'Fresh timetable unavailable'},503)}
}
