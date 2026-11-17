import {studyScopedMode} from '@/lib/studyAuth';
import {trustedInternalServiceUrl} from '@/lib/internalServiceUrl';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken, getTokenExpiresAt } from '@/lib/edusetTokenCrypto';

const EDUSET_BASE_URL = 'https://api.cbsh.edu-set.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 호출자의 Supabase 세션 토큰으로 RLS를 그대로 태워서 본인이 admin인지 확인한다 (서비스 롤 불필요) */
async function requireAdmin(request: NextRequest) {
  const scoped=studyScopedMode();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(scoped?trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE).toString():supabaseUrl, supabaseAnonKey, {
    ...(scoped?{auth:{persistSession:false,autoRefreshToken:false}}:{}),
    global: { headers: { Authorization: `Bearer ${token}` },...(scoped?{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,cache:'no-store' as const,redirect:'error' as const,signal:AbortSignal.timeout(5000)})}:{}) },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if(scoped&&error&&error.status!==401&&error.status!==403)throw Error('관리자 세션 확인 서버에 연결하지 못했습니다.');
  if (error || !user) return null;
  if(scoped){const proof=await client.rpc('cbgpu_self_session_status');if(proof.error||!proof.data||typeof proof.data.valid!=='boolean')throw Error('관리자 세션을 확인하지 못했습니다.');if(!proof.data.valid)return null;}

  const { data: profile,error:profileError } = await client
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if(scoped&&profileError&&profileError.code!=='PGRST116')throw Error('관리자 권한을 확인하지 못했습니다.');
  return profile?.is_admin===true ? { user, client } : null;
}

async function guardedAdmin(request:NextRequest){try{return{admin:await requireAdmin(request)}}catch{return{error:NextResponse.json({message:'관리자 권한 확인 서버에 연결하지 못했습니다.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}}}
export async function GET(request: NextRequest) {
  const {admin,error:authorizationError}=await guardedAdmin(request);
  if(authorizationError)return authorizationError;
  if (!admin) {
    return NextResponse.json({ message: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const { data,error:settingsError } = await admin.client
    .from('eduset_settings')
    .select('access_token_enc, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if(studyScopedMode()&&settingsError)return NextResponse.json({message:'연결 상태를 확인하지 못했습니다.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  let expiresAt: string | null = null;
  if (data?.access_token_enc) {
    try {
      const token = decryptToken(data.access_token_enc);
      expiresAt = getTokenExpiresAt(token);
    } catch {
      // A legacy/non-JWT token can still be valid. Status reporting must not break token use.
    }
  }

  return NextResponse.json({ updatedAt: data?.updated_at ?? null, expiresAt },{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let accessToken = String(body?.accessToken ?? '').trim().replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return NextResponse.json({ message: 'accessToken을 입력해주세요.' }, { status: 400 });
  }

  let verify:Response;try{
  verify = await fetch(`${EDUSET_BASE_URL}/rooms`, {
    headers: { Authorization: `Bearer ${accessToken}` },...(studyScopedMode()?{cache:'no-store' as const,redirect:'error' as const,signal:AbortSignal.timeout(10000)}:{}),
  });
  }catch(error){if(studyScopedMode())return NextResponse.json({message:'학교 연결 검증 서버에 연결하지 못했습니다.'},{status:503,headers:{'Cache-Control':'private, no-store'}});throw error;}
  if (!verify.ok) {
    return NextResponse.json(
      { message: '자습신청 사이트에서 토큰을 거절했습니다. 공식 사이트에서 다시 로그인해 새 토큰을 받아주세요.' },
      { status: 400 }
    );
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(accessToken);
  } catch (err: any) {
    return NextResponse.json({ message: err.message ?? '토큰 암호화에 실패했습니다.' }, { status: 500 });
  }

  if(studyScopedMode()){const fresh=await guardedAdmin(request);if(fresh.error)return fresh.error;if(!fresh.admin||fresh.admin.user.id!==admin.user.id)return NextResponse.json({message:'관리자 세션 또는 권한이 해제되었습니다.'},{status:403,headers:{'Cache-Control':'private, no-store'}});}
  const { error } = await admin.client
    .from('eduset_settings')
    .upsert({ id: 1, access_token_enc: encrypted, updated_at: new Date().toISOString(), updated_by: admin.user.id, expires_at: getTokenExpiresAt(accessToken) });

  if (error) {
    if(studyScopedMode())return NextResponse.json({message:'저장 권한 또는 결과를 확인하지 못했습니다.'},{status:error.code==='42501'?403:503,headers:{'Cache-Control':'private, no-store'}});
    return NextResponse.json({ message: `저장 중 오류가 발생했습니다: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
