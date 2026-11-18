import{notebookBootstrap}from'@/lib/notebookBootstrap';
import{proxyGpuRegistry,gpuBearer,gpuReply}from'@/lib/gpuRegistryProxy';
import{publicGpuArtifacts,publicGpuSetupArtifacts,publicGpuInstallerManifest,gpuArtifactDownload,gpuSetupArtifactDownload}from'@/lib/gpuAgentArtifacts';
import{gpuControlPlaneOrigin}from'@/lib/gpuRegistryRoutes';
import{trustedInternalServiceUrl}from'@/lib/internalServiceUrl';
import{boundedSchoolBody}from'@/lib/schoolsProxySecurity';
import{WindowRateLimiter}from'@/lib/requestSecurity';
export const runtime='nodejs';export const dynamic='force-dynamic';
const downloads=new WindowRateLimiter(60,60_000),capabilities=new WindowRateLimiter(120,60_000);
async function handle(request:Request,context:{params:Promise<{path?:string[]}>}){
 const{path=[]}=await context.params;
 if(request.method==='GET'&&path.length===1&&path[0]==='installer-manifest'){
  if(new URL(request.url).search)return gpuReply({error:'QUERY_NOT_SUPPORTED'},400);
  if(!downloads.allow((request.headers.get('cf-connecting-ip')||'local').slice(0,128)))return gpuReply({error:'RATE_LIMITED'},429);
  try{return Response.json(await publicGpuInstallerManifest(),{headers:{'Cache-Control':'public, max-age=60','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})}catch{return gpuReply({error:'INSTALLER_UNAVAILABLE'},503)}
 }
 if(request.method==='POST'&&path.length===3&&path[0]==='notebooks'&&path[2]==='bootstrap')return notebookBootstrap(request,path[1]);
 if(request.method==='GET'&&path.length===3&&['downloads','setup-downloads'].includes(path[0])){
  if(new URL(request.url).search)return gpuReply({error:'QUERY_NOT_SUPPORTED'},400);
  if(!downloads.allow((request.headers.get('cf-connecting-ip')||'local').slice(0,128)))return gpuReply({error:'RATE_LIMITED'},429);
  try{return await (path[0]==='setup-downloads'?gpuSetupArtifactDownload:gpuArtifactDownload)(path[1],path[2])||gpuReply({error:'NOT_FOUND'},404)}catch{return gpuReply({error:'INSTALLER_UNAVAILABLE'},503)}
 }
 if(request.method==='GET'&&path.length===1&&path[0]==='capabilities'){
  if(new URL(request.url).search)return gpuReply({error:'QUERY_NOT_SUPPORTED'},400);
  const auth=gpuBearer(request);if(!auth)return gpuReply({error:'AUTHENTICATION_REQUIRED'},401);
  if(!capabilities.allow((request.headers.get('cf-connecting-ip')||'local').slice(0,128)))return gpuReply({error:'RATE_LIMITED'},429);
  try{
   const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!key)throw Error('AUTH_UNAVAILABLE');
   const authUrl=trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE);authUrl.pathname='/auth/v1/user';authUrl.search='';authUrl.hash='';
   const verified=await fetch(authUrl,{headers:{apikey:key,Authorization:auth,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});if(verified.status===401||verified.status===403)return gpuReply({error:'INVALID_SESSION'},401);if(!verified.ok)throw Error('AUTH_UNAVAILABLE');const identity=JSON.parse(await boundedSchoolBody(verified.body,65536));if(typeof identity.id!=='string'||!identity.id)return gpuReply({error:'INVALID_SESSION'},401);
   const origin=gpuControlPlaneOrigin(process.env.CBGPU_GPU_CONTROL_PLANE_ORIGIN);let enabled=false,notebooks=false;
   if(process.env.CBGPU_GPU_REGISTRY_ENABLED==='1'){const endpoint=trustedInternalServiceUrl(process.env.CBGPU_GPU_REGISTRY_URL||'http://127.0.0.1:3548',process.env.CBGPU_INTERNAL_NETWORK_MODE);endpoint.pathname='/health';endpoint.search='';endpoint.hash='';const health=await fetch(endpoint,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});if(health.ok){const status=JSON.parse(await boundedSchoolBody(health.body,4096));enabled=status.enabled===true&&status.sharing===false;notebooks=enabled&&process.env.CBGPU_GPU_NOTEBOOKS_ENABLED==='1'&&status.notebooks_enabled===true}}
   let artifacts:Awaited<ReturnType<typeof publicGpuArtifacts>>=[];try{artifacts=await publicGpuArtifacts()}catch{/* Missing artifacts must never become a fabricated install command. */}
   let setup_artifacts:Awaited<ReturnType<typeof publicGpuSetupArtifacts>>=[];try{setup_artifacts=await publicGpuSetupArtifacts()}catch{}
   return gpuReply({enabled,setup_artifacts,mode:notebooks?'NOTEBOOKS_AVAILABLE':'INVENTORY_ONLY',notebooks_enabled:notebooks,control_plane_url:origin,artifacts,supported_os:['Ubuntu'],execution_ready:false,sharing_enabled:false});
  }catch{return gpuReply({error:'GPU_SETUP_UNAVAILABLE'},503)}
 }
 return proxyGpuRegistry(request,path);
}
export{handle as GET,handle as POST,handle as DELETE};
