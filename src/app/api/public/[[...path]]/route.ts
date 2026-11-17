import{NextRequest,NextResponse}from'next/server';
import{fetchPublicContent}from'@/lib/publicContentServer';
import{WindowRateLimiter}from'@/lib/requestSecurity';
export const runtime='nodejs';export const dynamic='force-dynamic';
const limits=new WindowRateLimiter(120,60_000),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:NextRequest,context:{params:Promise<{path?:string[]}>}){if(!limits.allow(request.headers.get('cf-connecting-ip')||'local'))return NextResponse.json({error:'PUBLIC_RATE_LIMIT'},{status:429,headers});const{path}=await context.params;const result=await fetchPublicContent(path||[],request.nextUrl.searchParams);return result.ok?NextResponse.json(result.data,{headers}):NextResponse.json({error:result.status===404?'NOT_FOUND':'PUBLIC_CONTENT_UNAVAILABLE'},{status:result.status,headers})}

const methodDenied=()=>NextResponse.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:{...headers,Allow:'GET, HEAD'}});export{methodDenied as POST,methodDenied as PATCH,methodDenied as DELETE,methodDenied as PUT,methodDenied as OPTIONS};
