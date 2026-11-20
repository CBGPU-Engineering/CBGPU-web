import {createStudioHandoff,studioHandoffConfig} from '@/lib/studioHandoff';
import {studioAuthority} from '@/lib/studioAuthority';
import {WindowRateLimiter} from '@/lib/requestSecurity';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const limits=new WindowRateLimiter(2400,60_000);
const handle=createStudioHandoff({config:()=>studioHandoffConfig(process.env),authorize:studioAuthority});
async function open(request:Request,context:{params:Promise<{id:string}>}){
 if(!limits.allow(request.headers.get('cf-connecting-ip')||'local'))return Response.json({error:'요청이 많아요. 잠시 후 다시 시도해 주세요.'},{status:429,headers:{'Cache-Control':'no-store'}});
 return handle(request,(await context.params).id);
}
export{open as GET,open as POST};
