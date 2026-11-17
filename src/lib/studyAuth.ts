import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {StudyFailure} from './edusetStudent';
import {scopedAccountMode} from './deployAccess';
import {trustedInternalServiceUrl} from './internalServiceUrl';

const supabaseUrl = process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const AUTH_CACHE_TTL_MS = 60_000;
const MAX_AUTH_CACHE_ENTRIES = 300;
const pendingAuth=new Map<string,Promise<boolean>>();
const authCache = new Map<string, number>(); // access token -> 유효 만료 시각 (승인된 경우만 저장)

function jwtSubject(token: string): string | null {
  try {
    const value=JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;return typeof value==='string'&&value.length<=128?value:null;
  } catch {
    return null;
  }
}

/** 로그인 + 승인된 CBGPU 사용자인지 확인한다 (x-cbgpu-auth 헤더의 Supabase 액세스 토큰 기준). */
export async function requireApprovedUser(request: NextRequest) {
  if(studyScopedMode()){await scopedStudyUser(request,'x-cbgpu-auth');return true;}
  const token = request.headers.get('x-cbgpu-auth')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const subject=jwtSubject(token);if(!subject)return false;
  let expiry=0;try{expiry=Number(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).exp)*1000}catch{return false}
  if(!Number.isFinite(expiry)||expiry<=Date.now()){authCache.delete(token);return false}
  const cachedUntil=authCache.get(token);if(cachedUntil&&cachedUntil>Date.now())return true;
  const inFlight=pendingAuth.get(token);if(inFlight)return inFlight;
  if(pendingAuth.size>=MAX_AUTH_CACHE_ENTRIES)return false;
  const check=(async()=>{
   const client=createClient(supabaseUrl,supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
   const [{data:{user},error},{data:profile,error:profileError}]=await Promise.all([client.auth.getUser(token),client.from('profiles').select('is_approved').eq('id',subject).maybeSingle()]);
   if(error||!user||user.id!==subject||profileError||!profile||profile.is_approved===false)return false;
   authCache.set(token,Math.min(Date.now()+AUTH_CACHE_TTL_MS,expiry));while(authCache.size>MAX_AUTH_CACHE_ENTRIES)authCache.delete(authCache.keys().next().value as string);return true;
  })().catch(()=>false).finally(()=>pendingAuth.delete(token));pendingAuth.set(token,check);return check;
}

/** Server flags only. Invalid flags fail closed rather than selecting legacy authority. */
export function studyScopedMode(){try{return scopedAccountMode()}catch{throw new StudyFailure('계정 권한 설정을 확인하지 못했습니다.',503)}}
function verificationUnavailable(){return new StudyFailure('CBGPU 권한 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',503)}
/** Every call uses caller-bound public credentials and fresh session/resource predicates. No positive cache. */
async function scopedStudyUser(request:Request,header='authorization'){
 const value=request.headers.get(header);const token=value?.match(/^Bearer\s+([^\s,]{1,32768})$/i)?.[1] || (header==='x-cbgpu-auth'&&value&&!/\s|,/.test(value)&&value.length<=32768?value:null);
 if(!token)throw new StudyFailure('CBGPU에 다시 로그인해 주세요.',401,'cbgpu_session_expired');
 try{
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!key||key.startsWith('sb_secret_'))throw verificationUnavailable();
  const origin=trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE).toString();
  const caller=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token},fetch:(input,init)=>fetch(input,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)})}});
  const {data,error}=await caller.auth.getUser(token);
  if(error){if(error.status===401||error.status===403)throw new StudyFailure('CBGPU에 다시 로그인해 주세요.',401,'cbgpu_session_expired');throw verificationUnavailable();}
  if(!data.user||(data.user as unknown as {deleted_at?:string}).deleted_at)throw new StudyFailure('CBGPU에 다시 로그인해 주세요.',401,'cbgpu_session_expired');
  const session=await caller.rpc('cbgpu_self_session_status');
  if(session.error)throw verificationUnavailable();
  if(!session.data||typeof session.data.valid!=='boolean')throw verificationUnavailable();
  if(session.data.valid!==true)throw new StudyFailure('CBGPU 로그인 세션이 만료되었습니다.',401,'cbgpu_session_expired');
  const scope=await caller.rpc('cbgpu_can_use_resource',{resource:'study',target_school:'cbsh'});
  if(scope.error||typeof scope.data!=='boolean')throw verificationUnavailable();
  if(scope.data!==true)throw new StudyFailure('충북과학고 자습 서비스 이용 권한이 없거나 승인 기간이 만료되었습니다.',403);
  return data.user;
 }catch(error){if(error instanceof StudyFailure)throw error;throw verificationUnavailable();}
}
/** Personal EduSet connection remains keyed by the unchanged global Auth identity. */
export async function requireStudyUser(request:Request){
 if(studyScopedMode())return scopedStudyUser(request);
 const [{publicationUser},{activeDeploymentSession}]=await Promise.all([import('./preprintsServer'),import('./deployAuth')]);
 const user=await publicationUser(request);if(!user||!await activeDeploymentSession(request,user.id))throw new StudyFailure('CBGPU에 다시 로그인해 주세요.',401,'cbgpu_session_expired');return user;
}
