import {boundedSchoolBody} from './schoolsProxySecurity.ts';
import {trustedInternalServiceUrl} from './internalServiceUrl.ts';
import {scopedAccountMode,deploymentProfileAllowed,canUseDeploymentCompute} from './deployAccess.ts';
import {StudioAuthorityError,studioJson,studioProjectPattern,type StudioPrincipal} from './studioHandoff.ts';
/** All checks are fresh. Reads existing execution policy; never seals or changes CPU allocations. */
export async function studioAuthorityCore(token:string,projectId:string,deps:{env:Readonly<Record<string,string|undefined>>;fetcher:typeof fetch;deployKey:()=>Promise<string>}):Promise<StudioPrincipal>{
 const{env,fetcher}=deps;
 const origin=trustedInternalServiceUrl(env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',env.CBGPU_INTERNAL_NETWORK_MODE).origin;
 const anon=env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!anon||!service||!studioProjectPattern.test(projectId))throw new StudioAuthorityError(503);
 const signal=AbortSignal.timeout(5000),v2=scopedAccountMode(env);
 const get=async(path:string,key:string,bearer:string,body?:unknown)=>fetcher(origin+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal});
 const array=async(response:Response)=>{if(!response.ok)throw new StudioAuthorityError(503);const rows:unknown=JSON.parse(await boundedSchoolBody(response.body,16384));if(!Array.isArray(rows))throw new StudioAuthorityError(503);return rows as Record<string,unknown>[]};
 const auth=await get('/auth/v1/user',anon,token);
 if(!auth.ok)throw new StudioAuthorityError(auth.status>=500||auth.status===429?503:401);
 const user=await studioJson(auth,65536),id=user.id;
 const available=(value:Record<string,unknown>,expected:string)=>value.id===expected&&!value.deleted_at&&!(typeof value.banned_until==='string'&&Date.parse(value.banned_until)>Date.now());
 if(typeof id!=='string'||!studioProjectPattern.test(id)||!available(user,id))throw new StudioAuthorityError(401);
 const session=await get('/rest/v1/rpc/cbgpu_self_session_status',anon,token,{});
 if(!session.ok)throw new StudioAuthorityError(session.status>=500||session.status===429?503:401);
 if((await studioJson(session)).valid!==true)throw new StudioAuthorityError(401);
 const rows=await array(await get('/rest/v1/cpu_projects?id=eq.'+projectId+'&select=id,user_id,status,access_scope,execution_mode,allocation_school_id',service,service));
 const project=rows[0];
 if(rows.length!==1||project.id!==projectId||project.status!=='approved'||project.access_scope!=='public'||typeof project.user_id!=='string'||!studioProjectPattern.test(project.user_id)||project.execution_mode==='UNASSIGNED_V1')throw new StudioAuthorityError(403);
 const owner=project.user_id;let role:'owner'|'editor'='owner';
 if(owner!==id){
  const currentOwner=await get('/auth/v1/admin/users/'+owner,service,service);
  if(!currentOwner.ok)throw new StudioAuthorityError(503);
  const value=await studioJson(currentOwner,65536),account=typeof value.user==='object'&&value.user?value.user as Record<string,unknown>:value;
  if(!available(account,owner))throw new StudioAuthorityError(403);
  const deployOrigin=trustedInternalServiceUrl(env.CBGPU_DEPLOY_API_URL||'http://127.0.0.1:3510',env.CBGPU_INTERNAL_NETWORK_MODE).origin;
  const team=await fetcher(deployOrigin+'/teams/server/'+projectId,{headers:{Host:'deploy.internal','x-cbgpu-deploy-key':await deps.deployKey(),'x-cbgpu-owner':id,'x-cbgpu-resource-owner':owner},cache:'no-store',redirect:'error',signal});
  if(!team.ok)throw new StudioAuthorityError(team.status>=500||team.status===429?503:403);
  const membership=await studioJson(team,65536);if(membership.owner_id!==owner||membership.my_role!=='editor')throw new StudioAuthorityError(403);role='editor';
 }
 for(const subject of new Set([id,owner])){
  const profile=await array(await get('/rest/v1/profiles?id=eq.'+subject+'&select=id,account_status,is_approved',service,service));
  if(profile.length!==1||!deploymentProfileAllowed(profile[0],subject,v2))throw new StudioAuthorityError(403);
 }
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  const response=await get('/rest/v1/rpc/'+name,service,service,args);
  if(!response.ok)throw new StudioAuthorityError(503);
  return JSON.parse(await boundedSchoolBody(response.body,4096)) as unknown;
 };
 if(project.allocation_school_id){
  let sessionId:unknown;try{sessionId=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{throw new StudioAuthorityError(401)}
  if(typeof sessionId!=='string'||!studioProjectPattern.test(sessionId))throw new StudioAuthorityError(401);
  // Existing stable SQL predicate checks the immutable project's target school and actor session.
  if(await rpc('cbgpu_central_compose_request',{project:projectId,owner,school:project.allocation_school_id,actor:id,actor_session:sessionId})!==true)throw new StudioAuthorityError(403);
 }else if(v2){
  if(!await canUseDeploymentCompute({rpc:async(name,args)=>({data:await rpc(name,args),error:null})},id,owner))throw new StudioAuthorityError(403);
 }
 return{userId:id,role};
}
