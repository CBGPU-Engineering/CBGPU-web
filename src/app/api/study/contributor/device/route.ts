import {requireStudyContributor,studyScopedMode} from '@/lib/studyContributorAuth';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
 try{
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  let client,user;
  if(studyScopedMode()){({client,user}=await requireStudyContributor(request))}else{
  client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error: authError } = await client.auth.getUser(token);
  user=data.user;
  if (authError || !user) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const { data: profile } = await client.from('profiles').select('is_approved').eq('id', user.id).single();
  if (profile?.is_approved === false) {
    return NextResponse.json({ message: '승인된 CBGPU 계정만 참여할 수 있습니다.' }, { status: 403 });
  }

  }
  const deviceKey = `cbgpu_${crypto.randomBytes(32).toString('base64url')}`;
  const keyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? 'Chrome 확장 프로그램').trim().slice(0, 80) || 'Chrome 확장 프로그램';

  const { error: joinError } = await client.from('eduset_contributors')
    .upsert({ user_id: user.id, enabled: true }, { onConflict: 'user_id' });
  if (joinError) {if(studyScopedMode())return NextResponse.json({message:joinError.code==='42501'?'기여자 소속을 다시 확인해 주세요.':'기기 연결을 저장하지 못했습니다.'},{status:joinError.code==='42501'?403:503,headers:{'Cache-Control':'private, no-store'}});return NextResponse.json({message:joinError.message},{status:500});}

  const { data: device, error } = await client.from('eduset_contributor_devices')
    .insert({ user_id: user.id, key_hash: keyHash, name }).select('id').single();
  if (error) {if(studyScopedMode())return NextResponse.json({message:error.code==='42501'?'기여자 소속을 다시 확인해 주세요.':'기기 연결을 저장하지 못했습니다.'},{status:error.code==='42501'?403:503,headers:{'Cache-Control':'private, no-store'}});return NextResponse.json({message:error.message},{status:500});}
  return NextResponse.json({ deviceKey, deviceId: device.id },{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const status=(error as {status?:number}).status;return NextResponse.json({message:error instanceof Error?error.message:'기여자 권한을 확인하지 못했습니다.'},{status:status===401||status===403?status:503,headers:{'Cache-Control':'private, no-store'}});}
}
/** Read-only eligibility proof; no device key, school token or owner configuration is returned. */
export async function GET(request:NextRequest){
 try{if(!studyScopedMode())return NextResponse.json({message:'Not found'},{status:404});await requireStudyContributor(request);return NextResponse.json({allowed:true},{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){const status=(error as {status?:number}).status;return NextResponse.json({allowed:false,message:error instanceof Error?error.message:'기여자 권한을 확인하지 못했습니다.'},{status:status===401||status===403?status:503,headers:{'Cache-Control':'private, no-store'}});}
}
