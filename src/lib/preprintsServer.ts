import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {activeDeploymentSession} from '@/lib/deployAuth';
export const paperFields='id,identifier,title,abstract,authors,category,published_at,current_version,license,status';
export function preprintsClient(){
 const url=process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321';const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw new Error('Publication service is unavailable');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getPublicPaper(id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))return null;
 const {data,error}=await preprintsClient().from('preprints').select(paperFields).eq('id',id).in('status',['published','withdrawn']).maybeSingle();
 if(error)throw new Error('Publication service is unavailable');return data;
}
export async function publicationUser(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token)return null;
 const client=preprintsClient();const {data,error}=await client.auth.getUser(token);if(error||!data.user||(data.user as unknown as {deleted_at?:string}).deleted_at)return null;
 const {data:profile}=await client.from('profiles').select('id,is_approved').eq('id',data.user.id).maybeSingle();if(!profile||profile.is_approved===false)return null;
 return data.user;
}

/** Identity only: project owner/member checks remain mandatory in each project service. */
export async function personalProjectUser(request:Request){
 const scoped=process.env.CBGPU_MULTISCHOOL_V1==='1'||['1','true'].includes(process.env.CBGPU_ACCOUNT_V2||'')||process.env.NEXT_PUBLIC_CBGPU_ACCOUNT_V2==='true';
 if(!scoped){const user=await publicationUser(request);return user&&await activeDeploymentSession(request,user.id)?user:null;}
 const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s,]+)$/i)?.[1];
 if(!token||token.length>32768)return null;
 const client=preprintsClient();const {data,error}=await client.auth.getUser(token);
 if(error||!data.user||(data.user as unknown as {deleted_at?:string}).deleted_at)return null;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!key)throw new Error('Project identity verification is unavailable');
 // The user's JWT, never the service role, determines auth.uid()/session_id in this self-only RPC.
 const caller=createClient(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const proof=await caller.rpc('cbgpu_self_session_status');
 if(proof.error)throw new Error('Project identity verification is unavailable');
 if(!proof.data||proof.data.valid!==true)return null;
 return data.user;
}
