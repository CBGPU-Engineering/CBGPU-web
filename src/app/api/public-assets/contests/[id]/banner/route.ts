import type{NextRequest}from'next/server';
import{fetchPublicBanner,publicImageHeaders}from'@/lib/publicAssetsServer';
import{WindowRateLimiter}from'@/lib/requestSecurity';
export const runtime='nodejs';export const dynamic='force-dynamic';
const hosts=new Set(['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com']),limits=new WindowRateLimiter(600,60_000);
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){
 const raw=(request.headers.get('host')||request.nextUrl.host).toLowerCase(),host=raw.replace(/:\d+$/,'');
 const local=host==='localhost'||host==='127.0.0.1';
 const forwarded=request.headers.get('x-cbgpu-public-host')||'';
 const demo=local&&process.env.CBGPU_DEMO==='1'&&process.env.CBGPU_DEMO_PUBLIC_ROUTES==='1';
 if(!hosts.has(host)&&!(local&&hosts.has(forwarded))&&!demo||request.nextUrl.search)return new Response(null,{status:404,headers:publicImageHeaders});
 if(!limits.allow(request.headers.get('cf-connecting-ip')||'anonymous'))return new Response(null,{status:429,headers:publicImageHeaders});
 return fetchPublicBanner((await context.params).id);
}
export async function HEAD(request:NextRequest,context:{params:Promise<{id:string}>}){const response=await GET(request,context);await response.body?.cancel();return new Response(null,{status:response.status,headers:response.headers})}
const denied=()=>new Response(null,{status:405,headers:{...publicImageHeaders,Allow:'GET, HEAD'}});export{denied as POST,denied as PUT,denied as PATCH,denied as DELETE,denied as OPTIONS};
