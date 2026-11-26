/** Scoped projections replace global academic-profile reads only after the V1 schema is enabled. */
export type ProfileLabel={id:string;full_name:string|null;student_id:string|null;avatar_url?:string|null;display_avatar_url?:string|null};
type Result={data:ProfileLabel[]|null;error:{message:string;code?:string}|null};
export type ProfileReader={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<Result>;from:(table:string)=>any};
export const scopedProfilesEnabled=()=>process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1';
function nameOnly(result:Result):Result{return{error:result.error,data:result.data?.map(person=>({id:person.id,full_name:person.full_name,student_id:null}))||null}}
function ids(values:string[]){return [...new Set(values)].filter(Boolean).slice(0,500)}
export async function manufacturingProfiles(client:ProfileReader,kind:'print'|'laser',users:string[],enabled=scopedProfilesEnabled()):Promise<Result>{const selected=ids(users);if(!selected.length)return{data:[],error:null};return enabled?await client.rpc('cbgpu_manufacturing_profiles',{p_kind:kind,p_user_ids:selected}):await client.from('profiles').select('id, full_name, student_id').in('id',selected)}
export async function contestOperatorProfiles(client:ProfileReader,contestId:string,users:string[]|null,studentNumber:string|null=null,enabled=scopedProfilesEnabled()):Promise<Result>{if(enabled)return await client.rpc('cbgpu_contest_operator_profiles',{p_contest:contestId,p_user_ids:users?ids(users):null,p_student_number:studentNumber?.trim()||null});if(studentNumber!==null){const result=await client.from('profiles').select('id,full_name,student_id').eq('student_id',studentNumber.trim()).maybeSingle();return{data:result.data?[result.data]:[],error:result.error}}return await client.from('profiles').select('id,full_name,student_id').in('id',ids(users||[]))}
export function manufacturingJobSelect(extra='',enabled=scopedProfilesEnabled()){return '*'+(enabled?'':', manager:manager_id(full_name, student_id)')+extra}
/** Historical submission values remain editable; a new V1 submission never inherits primary-school data. */
export function initialContestStudentNumber(existing:string|null|undefined,legacy:string|null|undefined,enabled=scopedProfilesEnabled()){return existing||(enabled?'':legacy)||''}
export function canShareContestStudentNumber(value:string,confirmed:boolean,team:boolean,enabled=scopedProfilesEnabled()){return !enabled||team||!value.trim()||confirmed}
export async function manufacturingManagers(client:ProfileReader,kind:'print'|'laser',users:string[]|null,printerId:number|null=null,enabled=scopedProfilesEnabled()):Promise<Result>{if(users!==null&&!users.length)return{data:[],error:null};if(enabled)return nameOnly(await client.rpc('cbgpu_manufacturing_managers',{p_kind:kind,p_printer_id:printerId,p_user_ids:users?ids(users):null}));let query=client.from('profiles').select('id, full_name, student_id');if(users!==null)query=query.in('id',ids(users));else if(kind==='laser')query=query.eq('is_laser_cut_manager',true);return await query.order('student_id')}
export async function attachManufacturingManagers(client:ProfileReader,kind:'print'|'laser',jobs:any[],enabled=scopedProfilesEnabled()){if(!enabled)return{data:jobs,error:null};const result=await manufacturingManagers(client,kind,jobs.map(j=>j.manager_id).filter(Boolean),null,true),map=new Map((result.data||[]).map(p=>[p.id,p]));return{data:jobs.map(j=>({...j,manager:map.get(j.manager_id)||null})),error:result.error}}
export async function studyMemberProfiles(client:ProfileReader,users:string[],enabled=scopedProfilesEnabled()):Promise<Result>{const selected=ids(users);if(!selected.length)return{data:[],error:null};return enabled?nameOnly(await client.rpc('cbgpu_study_member_profiles',{p_user_ids:selected})):await legacyStudyProfiles(client,selected)}
async function legacyStudyProfiles(client:ProfileReader,selected:string[]):Promise<Result>{const withAvatar=await client.from('profiles').select('id, full_name, student_id, avatar_url, display_avatar_url').in('id',selected);return withAvatar.error&&/display_avatar_url/.test(withAvatar.error.message||'')?await client.from('profiles').select('id, full_name, student_id, avatar_url').in('id',selected):withAvatar}

const UUID_V=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Avatars are the one thing that is shown across schools. The database function returns only {id, avatarUrl};
 * names, student numbers and schools keep following their own school-scoped rules, so anything else in the
 * answer is dropped here too. A failed lookup never blocks the screen: people just show without a picture.
 */
export async function memberAvatarUrls(client:ProfileReader,users:string[]):Promise<Map<string,string>>{
 const ids=[...new Set(users)].filter(value=>UUID_V.test(value)),avatars=new Map<string,string>();
 for(let start=0;start<ids.length;start+=500){
  try{
   const answer=await client.rpc('cbgpu_avatar_urls',{p_user_ids:ids.slice(start,start+500)}) as unknown as {data:unknown;error:unknown};
   if(answer.error||!Array.isArray(answer.data))continue;
   for(const row of answer.data as {id?:unknown;avatarUrl?:unknown}[])if(typeof row?.id==='string'&&typeof row.avatarUrl==='string')avatars.set(row.id,row.avatarUrl);
  }catch{/* keep the screen working without pictures */}
 }
 return avatars;
}
/** One entry per person: the name only if the school-scoped lookup allowed it, plus the avatar for everyone. */
export function withMemberAvatars(people:ProfileLabel[]|null,users:string[],avatars:Map<string,string>):ProfileLabel[]{
 const named=new Map((people??[]).map(person=>[person.id,person]));
 return[...new Set(users)].map(id=>({id,full_name:named.get(id)?.full_name??null,student_id:null,avatar_url:null,display_avatar_url:avatars.get(id)??null}));
}
