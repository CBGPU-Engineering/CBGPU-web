import {requireContributionDevice,contributorOrigin,studyScopedMode} from '@/lib/studyContributorAuth';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '@/lib/edusetTokenCrypto';

const EDUSET = 'https://api.cbsh.edu-set.com';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const legacySupabase = serviceRoleKey ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
 try{
  const scoped=studyScopedMode();
  const supabase=scoped&&serviceRoleKey?createClient(contributorOrigin(),serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)})}}):legacySupabase;
  if (!supabase) return NextResponse.json({ message: '서버 동기화 키가 설정되지 않았습니다.' }, { status: 500 });
  const deviceKey = request.headers.get('x-cbgpu-device')?.trim();
  if (!deviceKey || (scoped?!/^cbgpu_[A-Za-z0-9_-]{43}$/.test(deviceKey):!deviceKey.startsWith('cbgpu_'))) return NextResponse.json({ message: '연결 키가 필요합니다.' }, { status: 401 });

  const keyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');
  await requireContributionDevice(supabase,keyHash);
  const body = await request.json().catch(() => ({}));
  const accessToken = String(body?.accessToken ?? '').trim().replace(/^Bearer\s+/i, '');
  const parts = accessToken.split('.');
  if (parts.length !== 3) return NextResponse.json({ message: '올바른 edu-set 토큰이 아닙니다.' }, { status: 400 });

  let expiresAt: Date;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number') throw new Error();
    expiresAt = new Date(payload.exp * 1000);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() + 5 * 60_000) throw new Error();
  } catch {
    return NextResponse.json({ message: '만료됐거나 만료 시각이 없는 토큰입니다.' }, { status: 400 });
  }

  const verify = await fetch(`${EDUSET}/rooms`, { headers: { Authorization: `Bearer ${accessToken}` },...(scoped?{cache:'no-store' as const,redirect:'error' as const,signal:AbortSignal.timeout(10000)}:{}) });
  if (!verify.ok) return NextResponse.json({ message: 'edu-set에서 토큰을 거절했습니다.' }, { status: 400 });

  const { data: accepted, error } = await supabase.rpc('accept_eduset_contribution', {
    p_key_hash: keyHash,
    p_token_enc: encryptToken(accessToken),
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) return NextResponse.json({ message: scoped?'토큰 저장 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.':'토큰 저장에 실패했습니다: ' + error.message }, { status: scoped?503:500 });
  if (!accepted) return NextResponse.json({ message: scoped?'연결 키 또는 기여자 소속이 만료되거나 해제되었습니다.':'폐기됐거나 올바르지 않은 연결 키입니다.' }, { status: 403 });
  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() },{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const status=(error as {status?:number}).status;return NextResponse.json({message:error instanceof Error?error.message:'기여자 권한을 확인하지 못했습니다.'},{status:status===401||status===403?status:503,headers:{'Cache-Control':'private, no-store'}});}
}
