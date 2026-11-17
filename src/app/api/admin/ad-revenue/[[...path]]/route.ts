import {NextRequest,NextResponse}from'next/server';
import{trustedInternalServiceUrl}from'@/lib/internalServiceUrl';
import{boundedSchoolBody,schoolRequestOriginAllowed}from'@/lib/schoolsProxySecurity';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
async function handle(request:NextRequest,context:{params:Promise<{path?:string[]}>}){
 if(process.env.CBGPU_AD_REVENUE_ENABLED!=='1')return fail('Revenue reporting is not enabled.',404);
 const{path=[]}=await context.params;if(path.length>1||path.some(p=>!['analytics','imports','preview'].includes(p))||request.method==='POST'&&!['preview','imports'].includes(path[0]))return fail('Not found.',404);
 const authorization=request.headers.get('authorization');if(!authorization||!/^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(authorization))return fail('Sign in with your current platform administrator account.',401);
 if(request.method==='POST'&&!schoolRequestOriginAllowed(request.headers.get('x-cbgpu-public-host')||request.headers.get('host')||'',request.headers.get('origin')))return fail('Request origin is not allowed.',403);
 let body:string|undefined;if(request.method==='POST'){try{body=await boundedSchoolBody(request.body);JSON.parse(body)}catch{return fail('The report is too large or is not valid JSON.',400)}}
 let endpoint:URL;try{endpoint=trustedInternalServiceUrl(process.env.CBGPU_AD_REVENUE_API_URL||'http://127.0.0.1:3549',process.env.CBGPU_INTERNAL_NETWORK_MODE)}catch{return fail('Revenue reporting is unavailable.',503)}
 endpoint.pathname='/v1/admin/ad-revenue'+(path.length?'/'+path[0]:'');endpoint.search=request.nextUrl.search;
 try{const response=await fetch(endpoint,{method:request.method,headers:{'Content-Type':'application/json',Authorization:authorization},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});return new NextResponse(await response.text(),{status:response.status,headers:{...headers,'Content-Type':'application/json'}})}catch{return fail('Revenue reporting is unavailable. Your report has not been submitted.',503)}
}export{handle as GET,handle as POST};
