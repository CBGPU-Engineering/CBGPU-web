import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify, parseEnv } from 'node:util';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export const runtime = 'nodejs';
const run = promisify(execFile);
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
  const binary=process.env.CBGPU_CAREERS_BIN || path.join(os.homedir(),'.local/lib/cbgpu-rust/services/cbgpu-careers');
  const activeFile=process.env.CBGPU_CAREERS_ACTIVE_FILE || path.join(os.homedir(),'.local/share/cbgpu-rust/careers-active.json');
  try {
    let active: {store:string;env_file:string}|undefined;
    try {const text=await readFile(activeFile,'utf8');if(text.length>4096)throw Error('Invalid careers configuration');const value:unknown=JSON.parse(text);if(!value||typeof value!=='object'||!('store' in value)||!('env_file' in value)||typeof value.store!=='string'||typeof value.env_file!=='string')throw Error('Invalid careers configuration');active={store:value.store,env_file:value.env_file};}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const env: NodeJS.ProcessEnv={PATH:process.env.PATH,HOME:os.homedir(),NODE_ENV:process.env.NODE_ENV};
    let args=['--legacy-list',path.resolve(db)];
    if(active){if(active.store!=='postgres'||!path.isAbsolute(active.env_file))throw Error('Invalid careers storage');const values=parseEnv(await readFile(active.env_file,'utf8'));if(!values.CAREERS_DATABASE_URL?.match(/^postgres(?:ql)?:\/\//))throw Error('Invalid careers database');env.CAREERS_DATABASE_URL=values.CAREERS_DATABASE_URL;args=['--list'];}
    if(!path.isAbsolute(binary))throw Error('Invalid careers executable');
    const {stdout}=await run(binary,args,{timeout:10000,maxBuffer:16*1024*1024,env});
    const applications=JSON.parse(stdout);if(!Array.isArray(applications))throw Error('Invalid careers response');
    return reply({applications});
  } catch {
    return reply({error:'지원서 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  }
}
