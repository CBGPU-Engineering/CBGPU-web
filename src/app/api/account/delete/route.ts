import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {activeDeploymentSession} from '@/lib/deployAuth';
import {trustedInternalServiceUrl} from '@/lib/internalServiceUrl';
import {boundedSchoolBody} from '@/lib/schoolsProxySecurity';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status:number)=>NextResponse.json({message},{status,headers});
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function client(key:string){
 const url=trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE);
 return createClient(url.origin,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(5000)})}});
}
/** Only the fresh caller identity is authority. expected_user_id is an intent assertion, never a target. */
export async function POST(request:NextRequest){
 const token=request.headers.get('authorization')?.match(/^Bearer ([^\s,]{1,8192})$/i)?.[1];
 if(!token)return fail('로그인이 필요합니다.',401);
 const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!anon||!service)return fail('계정 서비스를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',503);
 let expected:unknown;
 if(request.body){try{
  const text=await boundedSchoolBody(request.body,512);
  if(text.trim()){
   const value:unknown=JSON.parse(text);
   if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>key!=='expected_user_id'))return fail('삭제 요청을 확인해 주세요.',400);
   expected=(value as Record<string,unknown>).expected_user_id;
   if(expected!==undefined&&!uuid(expected))return fail('삭제할 계정을 다시 확인해 주세요.',400);
  }
 }catch(error){return fail('삭제 요청을 확인해 주세요.',error instanceof Error&&error.message==='BODY_TOO_LARGE'?413:400)}}
 let userId:string;
 try{
  const{data,error}=await client(anon).auth.getUser(token);
  if(error)return fail('로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',error.status&&error.status>=400&&error.status<500&&error.status!==429?401:503);
  if(!data.user||!uuid(data.user.id))return fail('로그인이 필요합니다.',401);
  userId=data.user.id;
  if(expected!==undefined&&expected!==userId)return fail('계정이 바뀌었어요. 현재 계정에서 다시 확인해 주세요.',409);
  if(!await activeDeploymentSession(request,userId))return fail('로그인 세션이 종료됐어요. 다시 로그인해 주세요.',401);
 }catch{return fail('로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',503)}
 try{
  const admin=client(service);
  const{error:profileError}=await admin.from('profiles').update({full_name:null,student_id:null,avatar_url:null,is_approved:false}).eq('id',userId);
  if(profileError)return fail('프로필 삭제를 마치지 못했어요. 잠시 후 상태를 확인해 주세요.',503);
  const{error:deleteError}=await admin.auth.admin.deleteUser(userId,true);
  if(deleteError)return fail('계정 삭제를 마치지 못했어요. 잠시 후 상태를 확인해 주세요.',503);
  return NextResponse.json({ok:true},{headers});
 }catch{return fail('계정 삭제 결과를 확인하지 못했어요. 잠시 후 상태를 확인해 주세요.',503)}
}
