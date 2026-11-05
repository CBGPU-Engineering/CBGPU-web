import {timingSafeEqual} from 'node:crypto';
import {preprintsClient} from '@/lib/preprintsServer';
import {automationDue,koreaClock,runAutomaticStudy,type StudyAutomationSettings} from '@/lib/studyAutomation';
import {automaticStudyContext,automaticSchoolRequest,personalSchoolRead} from '@/lib/studyAutomationServer';
import type {StudyId} from '@/lib/edusetStudent';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
let busy=false;
export async function POST(req:Request){
 const expected=process.env.CBGPU_STUDY_AUTOMATION_SECRET,provided=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 const a=Buffer.from(expected||''),b=Buffer.from(provided);
 if(!expected||a.length!==b.length||!timingSafeEqual(a,b))return Response.json({message:'Forbidden'},{status:403});
 const now=new Date(),clock=koreaClock(now);
 if(clock.weekday===0||clock.weekday===6||clock.minute<450||clock.minute>930)return Response.json({ok:true,skipped:'weekday_window'});
 if(busy)return Response.json({ok:true,skipped:'running'});busy=true;
 try{
  const db=preprintsClient(),time=`${String(Math.floor(clock.minute/60)).padStart(2,'0')}:${String(clock.minute%60).padStart(2,'0')}:00`;
  const {data:settings,error}=await db.from('study_auto_settings').select('*').eq('enabled',true).lte('starts_on',clock.date).lte('run_time',time).order('run_time').limit(300);
  if(error)throw Error('Settings unavailable');
  let processed=0;const jobs:{row:{user_id:string;updated_at:string};config:StudyAutomationSettings}[]=[];
  for(const row of settings||[]){
   const config={...row,run_time:row.run_time.slice(0,5)} as StudyAutomationSettings;
   if(!automationDue(config,now))continue;
   const {data:runs}=await db.from('study_auto_runs').select('period,status,started_at').eq('user_id',row.user_id).eq('study_date',clock.date);
   const stale=(runs||[]).filter(r=>r.status==='running'&&Date.parse(r.started_at)<Date.now()-5*60_000);
   if(stale.length){
    const fresh=await automaticStudyContext(row.user_id).catch(()=>null);
    for(const old of stale){const found=fresh?.entries.some(e=>e.period===old.period);await db.from('study_auto_runs').update({status:found?'already_applied':'uncertain',message:found?'공식 명단에서 신청을 확인했어요.':'이전 실행이 중단되어 결과 확인이 필요해요. 중복 신청하지 않았어요.',finished_at:new Date().toISOString()}).eq('user_id',row.user_id).eq('study_date',clock.date).eq('period',old.period).eq('status','running')}
   }
   if(config.periods.every(p=>runs?.some(r=>r.period===p)))continue;
   jobs.push({row,config});if(jobs.length>=30)break;
  }
  // A bounded worker pool protects the school's API from a morning burst.
  let next=0;
  await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
   while(next<jobs.length){
    const {row,config}=jobs[next++];
    const {data:profile}=await db.from('profiles').select('is_approved').eq('id',row.user_id).maybeSingle();
    if(!profile||profile.is_approved===false)continue;
    const {data:account,error:accountError}=await db.auth.admin.getUserById(row.user_id);
    const identity=account?.user as {deleted_at?:string;banned_until?:string}|null;
    if(accountError||!identity||identity.deleted_at||identity.banned_until&&Date.parse(identity.banned_until)>Date.now())continue;
    try{
     await runAutomaticStudy(config,now,{
      context:()=>automaticStudyContext(row.user_id),
      seats:async id=>(await personalSchoolRead(row.user_id,'/rooms/'+id+'/composition')).seats,
      occupied:async(id,period,date)=>{
       const [rows,requests]=await Promise.all([
        personalSchoolRead(row.user_id,'/rooms/'+id+'/seats/occupations?date='+date),
        personalSchoolRead(row.user_id,'/selfstudy/search','POST',{date:date+'T00:00:00.000Z'}),
       ]);
       if(!Array.isArray(rows)||!Array.isArray(requests))throw Error('Seat status unavailable');
       const pending=requests.filter(r=>String(r.room?.id)===String(id)&&Number(r.period)===period&&r.status!=='REJECTED').map(r=>r.seat?.id);
       return [...rows.filter(r=>Number(r.period)===period&&r.status!=='REJECTED').map(r=>r.seatId??r.seat?.id),...pending].filter((id):id is StudyId=>id!==undefined&&id!==null);
      },
      claim:async period=>{const {data:current}=await db.from('study_auto_settings').select('enabled,updated_at').eq('user_id',row.user_id).maybeSingle();if(!current?.enabled||current.updated_at!==row.updated_at)return false;const {error}=await db.from('study_auto_runs').insert({user_id:row.user_id,study_date:clock.date,period,status:'running'});if(error&&error.code!=='23505')throw Error('Run state unavailable');return !error},
      finish:async result=>{const {error}=await db.from('study_auto_runs').update({...result,finished_at:new Date().toISOString()}).eq('user_id',row.user_id).eq('study_date',clock.date).eq('period',result.period);if(error)throw Error('Run state unavailable')},
      apply:async input=>{const response=await automaticSchoolRequest(row.user_id,input);const body=await response.json();return {ok:response.ok,status:response.status,code:body.code,message:body.message}},
     });processed++;
    }catch{ /* Personal account expiry or an unavailable school API never borrows another student's token. */ }
   }
  }));
  return Response.json({ok:true,processed},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({message:'Automation check failed'},{status:503})}finally{busy=false}
}
