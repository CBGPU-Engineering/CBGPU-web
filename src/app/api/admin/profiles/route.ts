import { NextRequest, NextResponse } from 'next/server';
import {adminAccountAffiliations} from '@/lib/adminAccountAffiliations';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: '계정 관리 설정을 확인해 주세요.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user || (user as unknown as { deleted_at?: string }).deleted_at) return NextResponse.json({ error: '다시 로그인해 주세요.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  const { data: caller } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!caller?.is_admin) return NextResponse.json({ error: '관리자만 사용할 수 있습니다.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  const active = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) return NextResponse.json({ error: '계정 목록을 불러오지 못했습니다.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
    for (const account of data.users) if (!(account as unknown as { deleted_at?: string }).deleted_at) active.set(account.id, account.email || '');
    if (data.users.length < 1000) break;
  }
  const { data, error: profileError } = await admin.from('profiles')
    .select('id, school_id, student_id, full_name, is_admin, is_approved, is_laser_cut_manager')
    .order('is_approved', { ascending: true, nullsFirst: true }).order('full_name', { ascending: true }).limit(1000);
  if (profileError) return NextResponse.json({ error: '프로필 목록을 불러오지 못했습니다.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  let projection:Awaited<ReturnType<typeof adminAccountAffiliations>>|null=null;
  if(process.env.CBGPU_MULTISCHOOL_V1==='1')try{
    projection=await adminAccountAffiliations('Bearer '+token,{endpoint:process.env.CBGPU_SCHOOLS_API_URL||'http://127.0.0.1:3546',networkMode:process.env.CBGPU_INTERNAL_NETWORK_MODE});
  }catch{return NextResponse.json({error:'학교 소속을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
  return NextResponse.json({ profiles: (data || []).filter(profile => active.has(profile.id)).map(profile => ({ ...profile, email: active.get(profile.id) || '',school_affiliations:projection?.affiliations.get(profile.id)??[],primary_school_name:projection?.schools.get(profile.school_id)??null })) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
