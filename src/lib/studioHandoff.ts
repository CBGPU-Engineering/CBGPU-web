import {boundedSchoolBody} from './schoolsProxySecurity.ts';
export const studioOpaquePattern=/^[A-Za-z0-9_-]{43}$/;
export const studioProjectPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type StudioConfig={projectId:string;adapterOrigin:string;publicOrigin:string};
export type StudioPrincipal={userId:string;role:'owner'|'editor'};
export class StudioAuthorityError extends Error{readonly status:401|403|503;constructor(status:401|403|503){super('Studio authority unavailable');this.status=status}}
export function studioHandoffConfig(env:Readonly<Record<string,string|undefined>>):StudioConfig|null{
 try{
  const projectId=env.CBGPU_STUDIO_PROJECT_ID||'';
  if(!studioProjectPattern.test(projectId))return null;
  const adapter=new URL(env.CBGPU_STUDIO_ADAPTER_URL||''),target=new URL(env.CBGPU_STUDIO_PUBLIC_ORIGIN||'');
  if(!['http:','https:'].includes(adapter.protocol)||!['127.0.0.1','localhost','[::1]'].includes(adapter.hostname)||adapter.username||adapter.password||adapter.pathname!=='/'||adapter.search||adapter.hash)return null;
  if(target.protocol!=='https:'||target.username||target.password||target.port||target.pathname!=='/'||target.search||target.hash||!/^[-a-z0-9]+\.server\.cbgpu\.com$/.test(target.hostname))return null;
  return{projectId,adapterOrigin:adapter.origin,publicOrigin:target.origin};
 }catch{return null}
}
export function studioLoginReturn(projectId:string,challenge:string){
 return studioProjectPattern.test(projectId)&&studioOpaquePattern.test(challenge)?`/server/${projectId}/open?challenge=${challenge}`:'/server';
}
export function studioRedeemDestination(value:unknown,origin:string|null):string|null{
 try{
  if(typeof value!=='string'||!origin)return null;
  const url=new URL(value),entries=[...url.searchParams.entries()];
  if(url.origin!==origin||url.protocol!=='https:'||url.username||url.password||url.hash||url.pathname!=='/_cbgpu/auth/redeem'||entries.length!==1||entries[0][0]!=='ticket'||!studioOpaquePattern.test(entries[0][1]))return null;
  return url.href;
 }catch{return null}
}
export async function studioJson(response:Response,maximum=4096):Promise<Record<string,unknown>>{
 if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw Error('Invalid studio response');
 const value:unknown=JSON.parse(await boundedSchoolBody(response.body,maximum));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid studio response');return value as Record<string,unknown>;
}
function firstPartyOrigin(request:Request){
 const url=new URL(request.url),forwarded=request.headers.get('x-cbgpu-public-host'),host=forwarded||request.headers.get('host')||url.host;
 if(['cbgpu.com','www.cbgpu.com','app.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com'].includes(host))return'https://'+host;
 if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&/^((localhost|127\.0\.0\.1)(:\d+)?|\[::1\](:\d+)?)$/.test(host))return url.origin;
 return null;
}
export function createStudioHandoff(deps:{config:()=>StudioConfig|null;authorize:(token:string,projectId:string)=>Promise<StudioPrincipal>;fetcher?:typeof fetch}){
 return async(request:Request,projectId:string):Promise<Response>=>{
  const headers={'Cache-Control':'private, no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Vary':'Authorization, Origin'};
  const fail=(error:string,status:number)=>Response.json({error},{status,headers});
  if(!['GET','POST'].includes(request.method))return fail('이 요청은 지원하지 않아요.',405);
  const config=deps.config();if(!config)return fail('연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요.',503);
  if(!studioProjectPattern.test(projectId)||projectId!==config.projectId)return fail('연결할 프로젝트를 찾지 못했어요.',404);
  const origin=firstPartyOrigin(request);if(!origin)return fail('연결 페이지를 확인해 주세요.',403);
  if(request.method==='POST'&&request.headers.get('origin')!==origin)return fail('연결 페이지를 새로고침한 뒤 다시 시도해 주세요.',403);
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s,]{1,8192})$/i)?.[1];
  if(!token)return fail('다시 로그인한 뒤 연결해 주세요.',401);
  let challenge:string|undefined;
  if(request.method==='POST'){
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return fail('연결 요청을 확인해 주세요.',400);
   try{const value:unknown=JSON.parse(await boundedSchoolBody(request.body,512));if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||typeof(value as Record<string,unknown>).challenge!=='string'||!studioOpaquePattern.test((value as {challenge:string}).challenge))return fail('앱에서 다시 열어 연결을 시작해 주세요.',400);challenge=(value as {challenge:string}).challenge}catch{return fail('연결 요청이 올바르지 않아요. 앱에서 다시 시작해 주세요.',400)}
  }
  try{
   const principal=await deps.authorize(token,projectId);
   if(!studioProjectPattern.test(principal.userId)||!['owner','editor'].includes(principal.role))throw new StudioAuthorityError(403);
   if(request.method==='GET')return Response.json({allowed:true,userId:principal.userId,role:principal.role},{headers});
   const response=await(deps.fetcher||fetch)(config.adapterOrigin+'/_cbgpu/auth/tickets',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({challenge}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10_000)});
   if(!response.ok){if([401,403].includes(response.status))throw new StudioAuthorityError(response.status as 401|403);return fail('앱 연결을 준비하지 못했어요. 앱에서 다시 시작해 주세요.',503)}
   const value=await studioJson(response);if(typeof value.ticket!=='string'||!studioOpaquePattern.test(value.ticket))throw Error('Invalid ticket');
   const target=new URL('/_cbgpu/auth/redeem',config.publicOrigin);target.searchParams.set('ticket',value.ticket);
   return Response.json({url:target.href},{headers});
  }catch(error){const status=error instanceof StudioAuthorityError?error.status:503;return fail(status===401?'로그인 상태가 바뀌었어요. 다시 로그인한 뒤 연결해 주세요.':status===403?'프로젝트 소유자·편집자 권한과 서버 이용 권한을 확인해 주세요.':'연결 권한을 확인하지 못했어요. 잠시 후 앱에서 다시 시작해 주세요.',status)}
 };
}
