import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {StudyFailure} from './edusetStudent';
import {studyScopedMode} from './studyAuth';
import {trustedInternalServiceUrl} from './internalServiceUrl';
export {studyScopedMode};
function unavailable(){return new StudyFailure('연결 기여 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',503)}
export function contributorOrigin(){return trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE).toString()}
/** A study guest grant is never contributor affiliation or an enrollment role. */
export async function requireStudyContributor(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s,]{1,32768})$/i)?.[1];if(!token)throw new StudyFailure('CBGPU에 로그인해 주세요.',401);
 try{
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!key||key.startsWith('sb_secret_'))throw unavailable();
  const client=createClient(contributorOrigin(),key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token},fetch:(input,init)=>fetch(input,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)})}});
  const {data,error}=await client.auth.getUser(token);if(error){if(error.status===401||error.status===403)throw new StudyFailure('CBGPU에 다시 로그인해 주세요.',401);throw unavailable();}if(!data.user)throw new StudyFailure('CBGPU에 다시 로그인해 주세요.',401);
  const session=await client.rpc('cbgpu_self_session_status');if(session.error||!session.data||typeof session.data.valid!=='boolean')throw unavailable();if(!session.data.valid)throw new StudyFailure('CBGPU 로그인이 만료됐어요. 다시 로그인해 주세요.',401);
  const access=await client.rpc('cbgpu_eduset_contributor_access');if(access.error||typeof access.data!=='boolean')throw unavailable();if(!access.data)throw new StudyFailure('소속 확인을 마친 충북과학고 재학생·교사만 연결에 기여할 수 있어요. 임시 자습 이용 권한은 기여자 권한에 포함되지 않아요.',403);
  return{user:data.user,client};
 }catch(error){if(error instanceof StudyFailure)throw error;throw unavailable();}
}
/** Device owner is resolved only in the database from the opaque credential hash. */
export async function requireContributionDevice(client:SupabaseClient,keyHash:string){
 if(!studyScopedMode())return;
 try{const {data,error}=await client.rpc('cbgpu_eduset_device_source_allowed',{p_key_hash:keyHash});if(error||typeof data!=='boolean')throw unavailable();if(!data)throw new StudyFailure('연결 키나 기여자 소속이 만료됐거나 해제됐어요. CBGPU에서 연결을 다시 확인해 주세요.',403);}catch(error){if(error instanceof StudyFailure)throw error;throw unavailable();}
}
