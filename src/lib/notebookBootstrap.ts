import{readFile,stat}from'node:fs/promises';
import{gpuBearer,gpuReply}from'./gpuRegistryProxy.ts';
import{trustedInternalServiceUrl}from'./internalServiceUrl.ts';
import{boundedSchoolBody}from'./schoolsProxySecurity.ts';
import{WindowRateLimiter}from'./requestSecurity.ts';
const parents=new Set(['https://cbgpu.com','https://www.cbgpu.com','https://app.cbgpu.com','https://student.cbgpu.com','https://researcher.cbgpu.com','https://developer.cbgpu.com']);
const limit=new WindowRateLimiter(30,60_000),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function notebookBootstrap(request:Request,job:string,send:typeof fetch=fetch){
 if(!uuid.test(job)||new URL(request.url).search)return gpuReply({error:'INVALID_REQUEST'},400);
 const auth=gpuBearer(request);if(!auth)return gpuReply({error:'AUTHENTICATION_REQUIRED'},401);
 const origin=request.headers.get('origin')||'',host=request.headers.get('x-cbgpu-public-host')||request.headers.get('host')||'';
 if(!parents.has(origin)||new URL(origin).host!==host)return gpuReply({error:'ORIGIN_NOT_ALLOWED'},403);
 if(!limit.allow((request.headers.get('cf-connecting-ip')||'local').slice(0,128)))return gpuReply({error:'RATE_LIMITED'},429);
 if(process.env.CBGPU_GPU_NOTEBOOKS_ENABLED!=='1'||process.env.CBGPU_GPU_REGISTRY_ENABLED!=='1')return gpuReply({error:'NOTEBOOKS_UNAVAILABLE'},503);
 try{
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return gpuReply({error:'JSON_REQUIRED'},415);
  const body=JSON.parse(await boundedSchoolBody(request.body,256));if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return gpuReply({error:'INVALID_BODY'},400);
  const registry=trustedInternalServiceUrl(process.env.CBGPU_GPU_REGISTRY_URL||'http://127.0.0.1:3548',process.env.CBGPU_INTERNAL_NETWORK_MODE);registry.pathname='/v1/gpu/notebooks/'+job+'/session';
  const response=await send(registry,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json',Accept:'application/json'},body:'{}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  const value=JSON.parse(await boundedSchoolBody(response.body,8192));if(!response.ok)return gpuReply({error:'NOTEBOOK_ACCESS_UNAVAILABLE'},[401,403,404,409,429].includes(response.status)?response.status:503);
  if(value.job_id!==job||typeof value.cookie_token!=='string'||!/^[a-f0-9]{64}$/.test(value.cookie_token))throw Error('INVALID_SESSION');
  const path=process.env.CBGPU_NOTEBOOK_BOOTSTRAP_KEY_FILE;if(!path?.startsWith('/'))throw Error('MISSING_KEY');const meta=await stat(path);if(!meta.isFile()||(meta.mode&0o077)!==0||meta.size!==64)throw Error('INVALID_KEY');const key=await readFile(path,'utf8');if(!/^[a-f0-9]{64}$/.test(key))throw Error('INVALID_KEY');
  const relay=trustedInternalServiceUrl(process.env.CBGPU_NOTEBOOK_RELAY_URL||'http://127.0.0.1:3557',process.env.CBGPU_INTERNAL_NETWORK_MODE);relay.pathname='/internal/bootstrap';
  const minted=await send(relay,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({job_id:job,cookie_token:value.cookie_token,parent_origin:origin}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});const dto=JSON.parse(await boundedSchoolBody(minted.body,2048));
  if(!minted.ok||typeof dto.bootstrap_token!=='string'||!/^[a-f0-9]{64}$/.test(dto.bootstrap_token)||dto.notebook_origin!=='https://notebooks.cbgpu.com'||!Number.isSafeInteger(dto.expires_at))throw Error('INVALID_BOOTSTRAP');
  return gpuReply({bootstrap_token:dto.bootstrap_token,notebook_origin:dto.notebook_origin,expires_at:new Date(dto.expires_at*1000).toISOString()});
 }catch{return gpuReply({error:'NOTEBOOK_CONNECTION_UNAVAILABLE'},503)}
}
