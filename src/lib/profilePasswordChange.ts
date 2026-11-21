'use client';
import{createClient,type SupabaseClient}from'@supabase/supabase-js';
import{supabase}from'./supabase';
import{changeConfirmedPassword}from'./confirmedPasswordChange';
export async function changeProfilePassword(input:{owner:string;email:string;currentPassword:string;newPassword:string},current:()=>boolean){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 let temporary:SupabaseClient|undefined,cleaning=false;
 return changeConfirmedPassword(input,current,{
  readSession:()=>supabase.auth.getSession(),
  verify:async signal=>{
   temporary=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'cbgpu-password-verification-'+crypto.randomUUID()},global:{fetch:(request,init)=>fetch(request,{...init,signal:cleaning?AbortSignal.timeout(3000):signal})}});
   const{data,error}=await temporary.auth.signInWithPassword({email:input.email,password:input.currentPassword});
   if(error){if(error.status&&error.status>=400&&error.status<500&&error.status!==429)throw Error('현재 비밀번호를 확인해 주세요.');throw Error('비밀번호 확인에 연결하지 못했어요. 입력한 내용은 유지했어요.');}
   if(!data.user)throw Error('로그인 계정을 확인하지 못했어요.');return data.user.id;
  },
  update:async(token,signal)=>{
   let response:Response;
   try{response=await fetch(url.replace(/\/$/,'')+'/auth/v1/user',{method:'PUT',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({password:input.newPassword,current_password:input.currentPassword}),credentials:'omit',redirect:'error',signal})}catch{throw Error('비밀번호 변경 결과를 확인하지 못했어요. 입력한 내용은 유지했어요. 잠시 후 다시 확인해 주세요.')}
   if(!response.ok){
    const failure=await response.json().catch(()=>null);
    if(response.status===401||response.status===403||['reauthentication_needed','reauthentication_not_valid'].includes(failure?.code))throw Error('보안 확인이 필요해요. 다시 로그인한 뒤 비밀번호를 변경해 주세요.');
    throw Error('비밀번호 변경 결과를 확인하지 못했어요. 입력한 내용은 유지했어요.');
   }
  },
  cleanup:async()=>{cleaning=true;if(temporary)await temporary.auth.signOut({scope:'local'})},
 });
}
