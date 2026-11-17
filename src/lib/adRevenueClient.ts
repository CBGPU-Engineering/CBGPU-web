'use client';
import{supabase}from'./supabase';
export async function revenueRequest<T>(owner:string,path:string,body?:unknown):Promise<T>{
 const{data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==owner)throw Error('Sign in again with your current platform administrator account.');
 const response=await fetch('/api/admin/ad-revenue/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const result=await response.json();if(!response.ok)throw Error(typeof result.error==='string'?result.error:'Revenue reporting is unavailable.');return result as T;
}
