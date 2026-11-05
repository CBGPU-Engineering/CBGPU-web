import {publicationUser,preprintsClient} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
import {readJsonBody,WindowRateLimiter} from '@/lib/requestSecurity';
import {validateAutomation,nextAutomaticStudyDate} from '@/lib/studyAutomation';
import {automaticStudyContext,personalSchoolRead,automationRuns} from '@/lib/studyAutomationServer';
export const runtime='nodejs';
const fields='enabled,starts_on,run_time,room_id,seat_id,teacher_id,reason,periods,updated_at';
const hosts=new Set(['cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com']);
const limits=new WindowRateLimiter(30,60_000);
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
async function handle(req:Request){
 try{
  const host=req.headers.get('host')?.split(':')[0]||new URL(req.url).hostname;
  if(!hosts.has(host))return reply({message:'Not found'},404);
  if(req.method==='POST'&&req.headers.get('origin')!=='https://'+host)return reply({message:'올바른 사이트에서 다시 시도해 주세요.'},403);
  const user=await publicationUser(req);if(!user||!await activeDeploymentSession(req,user.id))return reply({message:'CBGPU에 다시 로그인해 주세요.'},401);
  if(!limits.allow(user.id))return reply({message:'잠시 후 다시 시도해 주세요.'},429);
  const db=preprintsClient();
  if(req.method==='POST'){
   const body=await readJsonBody(req,8192) as Record<string,unknown>;
   if(body?.action==='disable'){
    const {error}=await db.from('study_auto_settings').update({enabled:false,updated_at:new Date().toISOString()}).eq('user_id',user.id);
    if(error)throw Error('자동신청을 끄지 못했습니다.');
   }else{
    const settings=validateAutomation(body),context=await automaticStudyContext(user.id);
    const room=context.rooms.find(r=>String(r.id)===settings.room_id&&r.hasSeats);
    if(!room||!context.teachers.some(t=>String(t.id)===settings.teacher_id))throw Error('교실 또는 담당 선생님을 다시 선택해 주세요.');
    const composition=await personalSchoolRead(user.id,'/rooms/'+room.id+'/composition');
    if(!composition?.seats?.some((s:{id:string|number})=>String(s.id)===settings.seat_id))throw Error('기본 자리를 다시 선택해 주세요.');
    const {error}=await db.from('study_auto_settings').upsert({user_id:user.id,...settings,starts_on:nextAutomaticStudyDate(settings.run_time,new Date()),run_time:settings.run_time+':00',updated_at:new Date().toISOString()});
    if(error)throw Error('자동신청 설정을 저장하지 못했습니다.');
   }
  }
  const [{data,error},runs]=await Promise.all([db.from('study_auto_settings').select(fields).eq('user_id',user.id).maybeSingle(),automationRuns(user.id)]);
  if(error)throw Error('자동신청 설정을 불러오지 못했습니다.');
  return reply({settings:data?{...data,run_time:data.run_time.slice(0,5)}:null,runs});
 }catch(error){return reply({message:error instanceof Error?error.message:'설정을 확인하지 못했습니다.'},(error as {status?:number}).status||400)}
}
export const GET=handle;export const POST=handle;
