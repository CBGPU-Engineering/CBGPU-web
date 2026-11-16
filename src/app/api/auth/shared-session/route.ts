import {createClient} from '@supabase/supabase-js';
import {handleSharedSession} from '@/lib/sharedSessionBroker';
import {createSharedSessionVerifier} from '@/lib/sharedSessionVerifier';
import {WindowRateLimiter} from '@/lib/requestSecurity';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const limits=new WindowRateLimiter(6000,60_000);
const verify=createSharedSessionVerifier(()=>{
 const url=process.env.SUPABASE_INTERNAL_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw Error('Auth unavailable');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10_000),cache:'no-store'})}});
});
async function handle(request:Request){
 if(!limits.allow(request.headers.get('cf-connecting-ip')||'local'))return Response.json({error:'Please retry shortly'},{status:429,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return handleSharedSession(request,verify);
}
export const GET=handle;
export const POST=handle;
export const OPTIONS=handle;
