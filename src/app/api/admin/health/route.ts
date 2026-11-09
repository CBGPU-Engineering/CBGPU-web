import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {readStudyConnection} from '@/lib/opsStatus';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Admin-only system status for the dashboards (same auth pattern as the other /api/admin routes). */
export async function GET(request: NextRequest) {
  const headers = {'Cache-Control': 'private, no-store'};
  const reply = (body: object, status = 200) => NextResponse.json(body, {status, headers});
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({error: '로그인이 필요합니다.'}, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return reply({error: '인증 서버 설정을 확인해 주세요.'}, 503);
  const client = createClient(url, key, {global: {headers: {Authorization: `Bearer ${token}`}}, auth: {persistSession: false, autoRefreshToken: false}});
  const {data: {user}, error} = await client.auth.getUser(token);
  if (error || !user) return reply({error: '다시 로그인해 주세요.'}, 401);
  const {data: profile, error: profileError} = await client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.is_admin) return reply({error: '관리자만 사용할 수 있습니다.'}, 403);
  return reply({study: await readStudyConnection(), generatedAt: new Date().toISOString()});
}
