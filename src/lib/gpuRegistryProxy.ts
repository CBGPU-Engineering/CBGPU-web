import{createHash}from'node:crypto';
import{trustedInternalServiceUrl}from'./internalServiceUrl.ts';
import{boundedSchoolBody,schoolRequestOriginAllowed}from'./schoolsProxySecurity.ts';
import{WindowRateLimiter}from'./requestSecurity.ts';
import{gpuRegistryPath}from'./gpuRegistryRoutes.ts';
const controls=new WindowRateLimiter(120,60_000),enrolls=new WindowRateLimiter(10,60_000),reports=new WindowRateLimiter(300,60_000);
export const gpuPrivateHeaders={'Cache-Control':'private, no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export const gpuReply=(value:unknown,status=200)=>Response.json(value,{status,headers:gpuPrivateHeaders});
export function gpuBearer(request:Request){return request.headers.get('authorization')?.match(/^Bearer ([^\s,]{1,8192})$/i)?.[0]||null}
/** The registry independently verifies fresh user sessions, school roles, enrollment proofs and signatures. */
export async function proxyGpuRegistry(request:Request,parts:string[],device=false,send:typeof fetch=fetch) {
 const target=gpuRegistryPath(parts,request.method,device);if(!target)return gpuReply({error:'NOT_FOUND'},404);
 const query=new URL(request.url).searchParams;
 const adminList=!device&&request.method==='GET'&&parts.length===5&&parts[0]==='schools'&&parts[2]==='gpu'&&parts[3]==='admin'&&parts[4]==='reservations';
 if(query.size&&!adminList)return gpuReply({error:'QUERY_NOT_SUPPORTED'},400);
 if(adminList){
  const allowed=new Set(['limit','cursor','status','q','gpu']);
  if([...query.keys()].some(key=>!allowed.has(key)||query.getAll(key).length!==1)||new URL(request.url).search.length>18000)return gpuReply({error:'INVALID_QUERY'},400);
  if(query.has('limit')&&!/^(?:[1-9]|[1-4][0-9]|50)$/.test(query.get('limit')!))return gpuReply({error:'INVALID_QUERY'},400);
  if(query.has('status')&&!['all','pending','approved','rejected','reserved','cancelled','revoked','active','upcoming','ended'].includes(query.get('status')!))return gpuReply({error:'INVALID_QUERY'},400);
  if((query.get('q')||'').length>150||(query.get('cursor')||'').length>4096||(query.has('gpu')&&!/^(?:all|[0-9]{1,10}|[a-fA-F0-9-]{36})$/.test(query.get('gpu')!)))return gpuReply({error:'INVALID_QUERY'},400);
 }

 const authorization=gpuBearer(request);if(!device&&!authorization)return gpuReply({error:'AUTHENTICATION_REQUIRED'},401);
 const ip=(request.headers.get('cf-connecting-ip')||'local').slice(0,128);
 const limiter=device?(parts[0]==='enroll'?enrolls:reports):controls,key=device?ip:createHash('sha256').update(authorization!).digest('hex');
 if(!limiter.allow(key))return gpuReply({error:'RATE_LIMITED'},429);
 if(!device&&request.method!=='GET'){
  const host=request.headers.get('x-cbgpu-public-host')||request.headers.get('host')||'';
  if(!schoolRequestOriginAllowed(host,request.headers.get('origin')))return gpuReply({error:'ORIGIN_NOT_ALLOWED'},403);
 }
 if(process.env.CBGPU_GPU_REGISTRY_ENABLED!=='1')return gpuReply({error:'GPU_ONBOARDING_UNAVAILABLE'},503);
 let endpoint:URL;try{endpoint=trustedInternalServiceUrl(process.env.CBGPU_GPU_REGISTRY_URL||'http://127.0.0.1:3548',process.env.CBGPU_INTERNAL_NETWORK_MODE);endpoint.pathname=target;endpoint.search=adminList?query.toString():'';endpoint.hash=''}catch{return gpuReply({error:'GPU_CONFIGURATION_UNAVAILABLE'},503)}
 let body:string|undefined;if(['POST','DELETE'].includes(request.method)){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return gpuReply({error:'JSON_REQUIRED'},415);
  try{body=await boundedSchoolBody(request.body,16384);const dto=JSON.parse(body);if(!dto||typeof dto!=='object'||Array.isArray(dto))throw Error('INVALID_BODY')}catch(e){return gpuReply({error:e instanceof Error&&e.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_BODY'},e instanceof Error&&e.message==='BODY_TOO_LARGE'?413:400)}
 }
 try{
  const response=await send(endpoint,{method:request.method,body,headers:{Accept:'application/json','Content-Type':'application/json',...(!device&&authorization?{Authorization:authorization}:{})},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20_000)});
  if(response.redirected)throw Error('REDIRECTED_UPSTREAM');
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw Error('INVALID_UPSTREAM_RESPONSE');
  const value=JSON.parse(await boundedSchoolBody(response.body,1048576));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_UPSTREAM_RESPONSE');
  if(!response.ok)return gpuReply({error:typeof value.error==='string'&&/^[A-Z_]{1,80}$/.test(value.error)?value.error:'GPU_REQUEST_FAILED'},[400,401,403,404,409,410,413,429].includes(response.status)?response.status:503);
  // Session credentials are never exposed in application JSON or a trusted-origin cookie.
  if(parts.at(-1)==='session'){
   if(typeof value.job_id!=='string'||typeof value.url!=='string'||value.url!=='/notebooks/'+value.job_id+'/lab'||typeof value.expires_at!=='string')throw Error('INVALID_NOTEBOOK_SESSION');
   return gpuReply({job_id:value.job_id,url:value.url,expires_at:value.expires_at},response.status);
  }
  return gpuReply(value,response.status);
 }catch{return gpuReply({error:'GPU_CONNECTION_UNAVAILABLE'},503)}
}
