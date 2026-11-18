export class AiSchoolAccessError extends Error{readonly status:number;constructor(message:string,status:number){super(message);this.status=status}}
export function schoolAiMode(env:Record<string,string|undefined>){const flags=[env.CBGPU_MULTISCHOOL_V1,env.CBGPU_ACCOUNT_V2];if(flags.some(v=>v!==undefined&&!['','0','false','1','true'].includes(v)))throw new AiSchoolAccessError('AI 권한 설정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.',503);return flags.some(v=>v==='1'||v==='true')}
export function validAiAccount(owner:string,user:{id?:string;deleted_at?:unknown;banned_until?:string|null;email_confirmed_at?:string|null}|null,profile:{id?:string;account_status?:string}|null,now=Date.now()){
 return /^[a-f0-9-]{36}$/i.test(owner)&&user?.id===owner&&profile?.id===owner&&!user.deleted_at&&!!user.email_confirmed_at&&!(user.banned_until&&(!Number.isFinite(Date.parse(user.banned_until))||Date.parse(user.banned_until)>now))&&['ACTIVE','PENDING_VERIFICATION','REVERIFICATION_REQUIRED'].includes(profile.account_status||'');
}
/** Key registry verifies the owner. A school header is only a target, never a grant.
 * API keys from schools other than CBsh must send `x-cbgpu-school-id: <school ID>`.
 * Missing headers retain the historical CBsh target; this is NOT the account's
 * stored current-school preference. No fallback selects another school on denial.
 * JWT requests instead use the authoritative current resource context.
 */
export async function requireAiSchoolAccess(input:{isKey:boolean;schoolHeader:string|null},readContexts:()=>Promise<unknown>,allowed:(school:string)=>Promise<boolean>){
 let school:string;
 if(input.isKey){school=input.schoolHeader??'cbsh';if(!/^[-a-zA-Z0-9_]{1,100}$/.test(school))throw new AiSchoolAccessError('x-cbgpu-school-id 헤더의 학교 ID를 확인해 주세요.',403)}
 else{
  const value=await readContexts() as {current_school_id?:unknown;items?:unknown};
  if(typeof value?.current_school_id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(value.current_school_id)||!Array.isArray(value.items))throw new AiSchoolAccessError('현재 학교를 선택하고 AI 사용 권한을 확인해 주세요.',403);
  school=value.current_school_id;
  const context=value.items.find((item:unknown)=>item&&typeof item==='object'&&(item as {school_id?:unknown}).school_id===school) as {type?:unknown;resources?:unknown}|undefined;
  if(!context||!['MEMBERSHIP','GUEST'].includes(String(context.type))||!Array.isArray(context.resources)||!context.resources.includes('ai'))throw new AiSchoolAccessError('현재 학교에서 AI 사용이 허용되지 않았어요. 학교의 AI·GPU 이용 정책을 확인해 주세요.',403);
 }
 if(!await allowed(school))throw new AiSchoolAccessError(input.isKey?'이 학교의 AI 사용 권한이 없어요. 다른 학교 계정의 API 키는 x-cbgpu-school-id 헤더에 소속 학교 ID를 넣고 학교의 AI·GPU 정책을 확인해 주세요.':'현재 학교의 AI 사용 권한이 만료되었거나 허용되지 않았어요.',403);
 return school;
}
