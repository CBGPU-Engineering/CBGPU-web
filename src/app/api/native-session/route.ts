import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {readJsonBody,WindowRateLimiter} from '@/lib/requestSecurity';
export const runtime='nodejs';
const limits=new WindowRateLimiter(60,60_000);
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!=='https://app.cbgpu.com')return reply({error:'Invalid origin.'},403);
 if(!limits.allow(req.headers.get('cf-connecting-ip')||'local'))return reply({error:'Please retry shortly.'},429);
 const access=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 let body:Record<string,unknown>;try{body=await readJsonBody(req,12_000) as Record<string,unknown>}catch{return reply({error:'Invalid request.'},400)}
 const refresh=body&&typeof body.refresh_token==='string'?body.refresh_token:'';
 if(!access||access.length>10_000||refresh.length<10||refresh.length>4096)return reply({error:'Invalid session.'},400);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!service)return reply({error:'Session connection unavailable.'},503);
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const client=createClient(url,key,options);
 let source_session:{access_token:string;refresh_token:string}|undefined;
 try{
  // Refresh credentials authenticate the source even after its access JWT
  // expires while the app is closed. Revoked refresh credentials still fail.
  const refreshed=await client.auth.refreshSession({refresh_token:refresh});
  if(refreshed.error||!refreshed.data.session||!refreshed.data.user?.email)return reply({error:'Please sign in again.'},401);
  source_session={access_token:refreshed.data.session.access_token,refresh_token:refreshed.data.session.refresh_token};
  const verified=await client.auth.getUser(source_session.access_token),user=verified.data.user;
  if(verified.error||!user?.email||user.id!==refreshed.data.user.id)return reply({error:'Please sign in again.'},401);
  const admin=createClient(url,service,options);
  // Generate a separate session without sending email or exposing the link hash.
  const generated=await admin.auth.admin.generateLink({type:'magiclink',email:user.email});
  if(generated.error||generated.data.user?.id!==user.id||!generated.data.properties?.hashed_token)return reply({error:'Could not connect app session.',source_session},503);
  const signed=await client.auth.verifyOtp({type:'magiclink',token_hash:generated.data.properties.hashed_token});
  if(signed.error||signed.data.user?.id!==user.id||!signed.data.session)return reply({error:'Could not connect app session.',source_session},503);
  return reply({source_session,session:{access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token}});
 }catch{return reply({error:'Session connection temporarily unavailable.',...(source_session?{source_session}:{})},503)}
}
