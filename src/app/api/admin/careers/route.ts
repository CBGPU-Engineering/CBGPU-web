import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export const runtime = 'nodejs';
const run = promisify(execFile);
const readApplications = `
import sqlite3,json,sys,pathlib
p=pathlib.Path(sys.argv[1]).resolve()
c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True,timeout=5)
c.row_factory=sqlite3.Row
rows=c.execute('SELECT id,created,role,name,email,affiliation,motivation,experience,portfolio,status FROM applications ORDER BY created DESC LIMIT 1000').fetchall()
print(json.dumps([dict(r) for r in rows],ensure_ascii=False))
`;
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const reply = (body: object, status=200) => NextResponse.json(body, {status, headers});
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({error:'로그인이 필요합니다.'},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return reply({error:'인증 서버 설정을 확인해 주세요.'},503);
  const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await client.auth.getUser(token);
  if (error || !user) return reply({error:'다시 로그인해 주세요.'},401);
  const {data:profile,error:profileError}=await client.from('profiles').select('is_admin').eq('id',user.id).maybeSingle();
  if (profileError || !profile?.is_admin) return reply({error:'관리자만 사용할 수 있습니다.'},403);
  const db=process.env.CBGPU_CAREERS_DB_PATH || '/home/cbgpu/CBGPU-live/backend/private/careers/applications.sqlite';
  try {
    const {stdout}=await run('python3',['-c',readApplications,db],{timeout:10000,maxBuffer:16*1024*1024});
    return reply({applications:JSON.parse(stdout)});
  } catch {
    return reply({error:'지원서 DB에 연결하지 못했습니다. 서버의 DB 경로와 읽기 권한을 확인해 주세요.'},503);
  }
}
