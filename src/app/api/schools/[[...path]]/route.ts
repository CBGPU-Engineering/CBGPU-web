import {NextRequest,NextResponse} from 'next/server';
import {WindowRateLimiter} from '@/lib/requestSecurity';
import {boundedSchoolBody,schoolRequestOriginAllowed} from '@/lib/schoolsProxySecurity';
import{trustedInternalServiceUrl}from'@/lib/internalServiceUrl';
import{publicSchoolSummary}from'@/lib/publicSchoolSummary';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const limits=new WindowRateLimiter(120,60_000);
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:NextRequest,context:{params:Promise<{path?:string[]}>}){
 if(process.env.CBGPU_MULTISCHOOL_V1!=='1')return fail('Not found',404);
 const {path=[]}=await context.params;if(path.some(part=>!/^[-a-zA-Z0-9_]{1,100}$/.test(part))||path.length>5)return fail('Not found',404);
 if(!['schools','memberships','current-school','school-applications','admin','publications','messages','message-mutes'].includes(path[0]))return fail('Not found',404);
 const host=request.headers.get('x-cbgpu-public-host')||request.headers.get('host')||'';const origin=request.headers.get('origin');if(!['GET','HEAD'].includes(request.method)&&!schoolRequestOriginAllowed(host,origin))return fail('요청 출처를 확인할 수 없어요.',403);
 if(!limits.allow(request.headers.get('cf-connecting-ip')||'local'))return fail('요청이 많아요. 잠시 후 다시 시도해주세요.',429);
 let endpoint:URL;try{endpoint=trustedInternalServiceUrl(process.env.CBGPU_SCHOOLS_API_URL||'http://127.0.0.1:3546',process.env.CBGPU_INTERNAL_NETWORK_MODE);}catch{return fail('학교 서비스 연결 설정을 확인하고 있어요.',503)}
 const publicRead=request.method==='GET'&&path[0]==='schools'&&path.length<=2;
 const authorization=request.headers.get('authorization');if(!publicRead&&!authorization?.startsWith('Bearer '))return fail('로그인 후 이용해주세요.',401);
 let body:string|undefined;if(!['GET','HEAD'].includes(request.method)){if(Number(request.headers.get('content-length')||0)>131072)return fail('입력 내용이 너무 길어요.',413);try{body=await boundedSchoolBody(request.body);if(body.trim())JSON.parse(body);else if(request.method==='DELETE')body=undefined;else throw Error('EMPTY_BODY')}catch(e){return fail(e instanceof Error&&e.message==='BODY_TOO_LARGE'?'입력 내용이 너무 길어요.':'입력 내용을 확인해주세요.',e instanceof Error&&e.message==='BODY_TOO_LARGE'?413:400)}}
 endpoint.pathname='/v1/'+path.map(encodeURIComponent).join('/');endpoint.search=request.nextUrl.search;
 try{const response=await fetch(endpoint,{method:request.method,headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20_000)});if(publicRead&&response.ok){const data=await response.json();if(path.length===1){if(!Array.isArray(data.items)||data.items.length>100||!Number.isSafeInteger(data.total)||data.total<0)return fail('학교 목록을 확인하지 못했어요.',503);const items=data.items.map(publicSchoolSummary);if(items.some((item:unknown)=>item===null))return fail('학교 목록을 확인하지 못했어요.',503);return NextResponse.json({items,total:data.total},{headers:{'Cache-Control':'no-store'}})}const school=publicSchoolSummary(data.school);return school?NextResponse.json({school},{headers:{'Cache-Control':'no-store'}}):fail('학교 소개를 확인하지 못했어요.',503)}return new NextResponse(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch{return fail('학교 서비스에 연결하지 못했어요. 입력한 내용은 유지되니 다시 시도해주세요.',503)}
}
export{handle as GET,handle as POST,handle as PATCH,handle as DELETE};
