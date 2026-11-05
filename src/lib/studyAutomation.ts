import type {StudyContext,StudyId,StudySeat} from './edusetStudent';
export type StudyAutomationSettings={enabled:boolean;run_time:string;room_id:string;seat_id:string;teacher_id:string;reason:string;periods:number[];starts_on?:string};
export const AUTO_STUDY_MIN='07:30',AUTO_STUDY_MAX='15:30';
export function koreaClock(now:Date){const local=new Date(now.getTime()+9*60*60_000);return {date:local.toISOString().slice(0,10),minute:local.getUTCHours()*60+local.getUTCMinutes(),weekday:local.getUTCDay()}}
export function validateAutomation(input:unknown):StudyAutomationSettings{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('설정 내용을 확인해 주세요.');
 const x=input as Record<string,unknown>;
 if(typeof x.enabled!=='boolean'||typeof x.run_time!=='string'||!/^\d{2}:\d{2}$/.test(x.run_time)||x.run_time<AUTO_STUDY_MIN||x.run_time>AUTO_STUDY_MAX||Number(x.run_time.slice(3))>59)throw Error('실행 시각은 07:30부터 15:30까지 선택해 주세요.');
 const ids=['room_id','seat_id','teacher_id'] as const;for(const id of ids)if(typeof x[id]!=='string'||!/^[-\w]{1,100}$/.test(x[id] as string))throw Error('교실·기본 자리·담당 선생님을 선택해 주세요.');
 if(typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>1000)throw Error('신청 사유를 확인해 주세요.');
 if(!Array.isArray(x.periods)||!x.periods.length||x.periods.length>12||x.periods.some(p=>!Number.isInteger(p)||p<1||p>12))throw Error('자동신청할 교시를 선택해 주세요.');
 return {enabled:x.enabled,run_time:x.run_time,room_id:x.room_id as string,seat_id:x.seat_id as string,teacher_id:x.teacher_id as string,reason:x.reason.trim(),periods:[...new Set(x.periods as number[])].sort((a,b)=>a-b)};
}
export function automationDue(settings:StudyAutomationSettings,now:Date){const c=koreaClock(now),[h,m]=settings.run_time.split(':').map(Number);return settings.enabled&&(!settings.starts_on||settings.starts_on<=c.date)&&c.weekday>=1&&c.weekday<=5&&c.minute>=h*60+m&&c.minute<=15*60+30}
export function nearestAvailableSeats(seats:StudySeat[],preferred:StudyId,occupied:StudyId[]){
 const target=seats.find(s=>String(s.id)===String(preferred));if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))throw Error('저장된 기본 자리의 배치 정보를 확인하지 못했습니다.');
 const taken=new Set(occupied.map(String));
 return seats.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&!taken.has(String(s.id)))
 .sort((a,b)=>Number(String(b.id)===String(preferred))-Number(String(a.id)===String(preferred))||((a.x-target.x)**2+(a.y-target.y)**2)-((b.x-target.x)**2+(b.y-target.y)**2)||a.name.localeCompare(b.name,'ko',{numeric:true})||String(a.id).localeCompare(String(b.id)));
}
export type AutoStudyResult={period:number;status:'applied'|'already_applied'|'no_seats'|'failed'|'uncertain'|'unavailable';message:string;seat_name?:string;room_name?:string};
type Dependencies={context:()=>Promise<StudyContext>;seats:(room:StudyId)=>Promise<StudySeat[]>;occupied:(room:StudyId,period:number,date:string)=>Promise<StudyId[]>;claim:(period:number)=>Promise<boolean>;finish:(result:AutoStudyResult)=>Promise<void>;apply:(input:Record<string,unknown>)=>Promise<{ok:boolean;status:number;code?:string;message?:string}>};
export async function runAutomaticStudy(settings:StudyAutomationSettings,now:Date,deps:Dependencies){
 if(!automationDue(settings,now))return {skipped:'not_due',results:[] as AutoStudyResult[]};
 let context=await deps.context();if(!context.open)return {skipped:'school_closed',results:[] as AutoStudyResult[]};
 const results:AutoStudyResult[]=[];
 const room=context.rooms.find(r=>String(r.id)===settings.room_id&&r.hasSeats);
 if(!room||!context.teachers.some(t=>String(t.id)===settings.teacher_id))throw Error('저장된 교실 또는 담당 선생님을 다시 선택해 주세요.');
 let seats:StudySeat[]|null=null;
 for(const period of [...settings.periods].sort((a,b)=>a-b)){
  if(!context.periods.includes(period))continue;
  if(!await deps.claim(period))continue;
  let result:AutoStudyResult;
  try{
   context=await deps.context();
   if(context.entries.some(e=>e.period===period))result={period,status:'already_applied',message:'이미 신청돼 있어 기존 신청을 유지했어요.'};
   else if(!context.open)result={period,status:'unavailable',message:'학교의 공식 접수가 종료됐어요.'};
   else{
    seats??=await deps.seats(room.id);
    const occupied=await deps.occupied(room.id,period,context.date);
    const candidates=nearestAvailableSeats(seats,settings.seat_id,occupied);
    if(!candidates.length)result={period,status:'no_seats',message:'선택한 교실에 빈자리가 없어요.'};
    else{
     const seat=candidates[0];
     const response=await deps.apply({action:'apply',date:context.date,roomId:room.id,seatId:seat.id,teacherId:settings.teacher_id,period,reason:settings.reason});
     if(response.ok)result={period,status:'applied',message:'공식 명단에 신청했어요.',seat_name:seat.name,room_name:room.name};
     else{
      // A response can be lost after the school has committed. Read back,
      // never blindly submit again (even to another seat).
      const fresh=await deps.context().catch(()=>null);
      if(fresh?.entries.some(e=>e.period===period))result={period,status:'already_applied',message:'공식 명단에서 신청을 확인했어요.'};
      else result={period,status:response.status>=500||['submission_uncertain','submission_in_progress'].includes(response.code||'')?'uncertain':'failed',message:response.message||'학교에서 신청을 확인하지 못했어요.'};
     }
    }
   }
  }catch{result={period,status:'uncertain',message:'신청 상태를 확실히 확인하지 못했어요. 내 신청을 확인해 주세요.'}}
  await deps.finish(result);results.push(result);
  if(result.status==='uncertain')break;
 }
 return {results};
}

export function nextAutomaticStudyDate(time:string,now:Date){
 const clock=koreaClock(now),[h,m]=time.split(':').map(Number);
 const day=new Date(clock.date+'T12:00:00Z');
 if(clock.minute>h*60+m)day.setUTCDate(day.getUTCDate()+1);
 while(day.getUTCDay()===0||day.getUTCDay()===6)day.setUTCDate(day.getUTCDate()+1);
 return day.toISOString().slice(0,10);
}
