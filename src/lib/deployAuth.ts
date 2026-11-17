import 'server-only';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {boundedSchoolBody} from './schoolsProxySecurity';
import {trustedInternalServiceUrl} from './internalServiceUrl';
const run=promisify(execFile);
/** A logged-out session must not retain access through a still-unexpired JWT. */
export async function activeDeploymentSession(request:Request,userId:string){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s,]{1,8192})$/i)?.[1];if(!token||!/^[a-f0-9-]{36}$/i.test(userId))return false;
 let sessionId:unknown,subject:unknown;try{const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());sessionId=claims.session_id;subject=claims.sub}catch{return false}
 if(typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/i.test(sessionId)||subject!==userId)return false;
 const configured=process.env.CBGPU_SESSION_ORACLE_MODE;
 if(configured&&!['rpc','legacy-docker'].includes(configured))throw Error('Session verification configuration is unavailable');
 const flags=[process.env.CBGPU_MULTISCHOOL_V1,process.env.CBGPU_ACCOUNT_V2];
 if(flags.some(value=>value!==undefined&&!['','0','false','1','true'].includes(value)))throw Error('Session verification configuration is unavailable');
 const scoped=flags.some(value=>value==='1'||value==='true');
 if(configured==='rpc'||scoped){
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!key)throw Error('Session verification is unavailable');
  const endpoint=trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE);
  endpoint.pathname='/rest/v1/rpc/cbgpu_self_session_status';endpoint.search='';endpoint.hash='';
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
  if(response.status===401||response.status===403)return false;
  if(!response.ok)throw Error('Session verification is unavailable');
  const value=JSON.parse(await boundedSchoolBody(response.body,4096));return value?.valid===true;
 }
 // Compatibility for an unchanged legacy host only; new containers use the caller-JWT RPC.
 const query=`SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id='${sessionId}'::uuid AND user_id='${userId}'::uuid AND (not_after IS NULL OR not_after>now()))`;
 const result=await run('/usr/bin/docker',['exec','cbgpu-supabase-db','psql','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',query],{timeout:5000,maxBuffer:1000});return result.stdout.trim()==='t';
}
