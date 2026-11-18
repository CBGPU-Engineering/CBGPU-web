import type {Contest} from './contests';
/** Copy scheduling and school audience explicitly; database defaults may name a different school. */
export function contestDuplicatePolicy(contest:Contest,offset:number,multiSchool:boolean){
 if(!Number.isFinite(offset))throw Error('복제할 행사 일정을 확인해 주세요.');
 const shift=(value:string|null|undefined)=>value?new Date(new Date(value).getTime()+offset).toISOString():null;
 return {
  registration_opens_at:shift(contest.registration_opens_at),
  registration_closes_at:shift(contest.registration_closes_at),
  starts_at:shift(contest.starts_at),ends_at:shift(contest.ends_at),
  ...(multiSchool&&contest.school_id?{school_id:contest.school_id,access_scope:contest.access_scope,allowed_school_ids:[...(contest.allowed_school_ids||[])],participant_policy:contest.participant_policy}:{}),
 };
}
