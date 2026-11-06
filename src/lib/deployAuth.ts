import 'server-only';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
/** A logged-out session must not keep deploying with a still-unexpired JWT. */
export async function activeDeploymentSession(request:Request,userId:string){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token||!/^[a-f0-9-]{36}$/.test(userId))return false;
 let sessionId:unknown;try{sessionId=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).session_id}catch{return false}if(typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/.test(sessionId))return false;
 const query=`SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id='${sessionId}'::uuid AND user_id='${userId}'::uuid AND (not_after IS NULL OR not_after>now()))`;
 const psql=['exec','cbgpu-supabase-db','psql','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c'];
 // 개발용: 이 컴퓨터에는 DB 컨테이너가 없으므로 CBGPU_DB_SSH(예: cbgpu@서버주소)가 있으면 ssh로 서버에 대신 물어본다. 운영(production) 빌드에서는 절대 쓰지 않는다.
 const viaSsh=process.env.NODE_ENV!=='production'?process.env.CBGPU_DB_SSH:undefined;
 const result=viaSsh&&/^[A-Za-z0-9_.-]+@[A-Za-z0-9_.:-]+$/.test(viaSsh)
  ?await run('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=4',viaSsh,'docker',...psql.slice(1),"'"+query.replace(/'/g,"'\\''")+"'"],{timeout:9000,maxBuffer:1000})
  :await run('/usr/bin/docker',[...psql,query],{timeout:5000,maxBuffer:1000});
 return result.stdout.trim()==='t';
}
