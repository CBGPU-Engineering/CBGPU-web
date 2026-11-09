import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const AUTH_CACHE_TTL_MS = 60_000;
const MAX_AUTH_CACHE_ENTRIES = 300;
const pendingAuth=new Map<string,Promise<boolean>>();
const authCache = new Map<string, number>(); // access token -> 유효 만료 시각 (승인된 경우만 저장)

function jwtSubject(token: string): string | null {
  try {
    const value=JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;return typeof value==='string'&&value.length<=128?value:null;
  } catch {
    return null;
  }
}

/** 로그인 + 승인된 CBGPU 사용자인지 확인한다 (x-cbgpu-auth 헤더의 Supabase 액세스 토큰 기준). */
export async function requireApprovedUser(request: NextRequest) {
  const token = request.headers.get('x-cbgpu-auth')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const subject=jwtSubject(token);if(!subject)return false;
  let expiry=0;try{expiry=Number(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).exp)*1000}catch{return false}
  if(!Number.isFinite(expiry)||expiry<=Date.now()){authCache.delete(token);return false}
  const cachedUntil=authCache.get(token);if(cachedUntil&&cachedUntil>Date.now())return true;
  const inFlight=pendingAuth.get(token);if(inFlight)return inFlight;
  if(pendingAuth.size>=MAX_AUTH_CACHE_ENTRIES)return false;
  const check=(async()=>{
   const client=createClient(supabaseUrl,supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
   const [{data:{user},error},{data:profile,error:profileError}]=await Promise.all([client.auth.getUser(token),client.from('profiles').select('is_approved').eq('id',subject).maybeSingle()]);
   if(error||!user||user.id!==subject||profileError||!profile||profile.is_approved===false)return false;
   authCache.set(token,Math.min(Date.now()+AUTH_CACHE_TTL_MS,expiry));while(authCache.size>MAX_AUTH_CACHE_ENTRIES)authCache.delete(authCache.keys().next().value as string);return true;
  })().catch(()=>false).finally(()=>pendingAuth.delete(token));pendingAuth.set(token,check);return check;
}
