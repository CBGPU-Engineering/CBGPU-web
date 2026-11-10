import 'server-only';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {publicationUser,preprintsClient} from './preprintsServer';
import {activeDeploymentSession} from './deployAuth';
import {WindowRateLimiter} from './requestSecurity';
import {workspaceOrigins} from './workspaces';

export class AiFailure extends Error{constructor(message:string,public status=400){super(message)}}
const writes=new WindowRateLimiter(35,60_000),reads=new WindowRateLimiter(180,60_000);
const origins=new Set([...workspaceOrigins,'https://arxiv.cbgpu.com','https://docs.cbgpu.com']);
export async function aiInternal(path:string,owner:string,method='GET',body?:unknown,stream?:ReadableStream<Uint8Array>|null,query=''){
 const key=(await readFile('/home/cbgpu/.config/cbgpu-ai-internal-key','utf8')).trim();
 const headers:Record<string,string>={'x-cbgpu-ai-key':key,'x-cbgpu-owner':owner,'Content-Type':stream?'application/octet-stream':'application/json'};
 return fetch('http://127.0.0.1:3550/'+path+query,{method,headers,body:stream??(body===undefined?undefined:JSON.stringify(body)),...(stream?{duplex:'half'}:{}),signal:AbortSignal.timeout(stream?180_000:path.endsWith('/messages')||path.startsWith('web/')?45_000:path.startsWith('downloads/')||path.endsWith('/artifact')?600_000:20_000),cache:'no-store'} as RequestInit);
}
export async function aiJson(path:string,owner:string,method='GET',body?:unknown){
 let response:Response;try{response=await aiInternal(path,owner,method,body)}catch{throw new AiFailure('로컬 AI 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',503)}
 const result=await response.json();if(!response.ok)throw new AiFailure(result.message||'AI 요청을 처리하지 못했어요.',response.status);return result;
}
export async function aiIdentity(request:Request,keysAllowed=true){
 const origin=request.headers.get('origin');if(!['GET','HEAD'].includes(request.method)&&origin&&!origins.has(origin))throw new AiFailure('허용되지 않은 요청 주소입니다.',403);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token)throw new AiFailure('CBGPU 계정으로 로그인해 주세요.',401);
 let owner:string,isKey=false;
 if(token.startsWith('cbgpu_ai_')){
  if(!keysAllowed)throw new AiFailure('이 작업에는 CBGPU 계정 로그인이 필요해요.',403);
  owner=(await aiJson('authenticate-key','','POST',{key:token})).owner;isKey=true;
  const client=preprintsClient();const [{data:profile,error},{data:account}]=await Promise.all([client.from('profiles').select('id,is_approved').eq('id',owner).maybeSingle(),client.auth.admin.getUserById(owner)]);
  if(error||!profile||profile.is_approved===false||!account.user||account.user.banned_until&&Date.parse(account.user.banned_until)>Date.now())throw new AiFailure('이 계정은 AI를 사용할 수 없어요.',403);
 }else{
  const user=await publicationUser(request);if(!user||!await activeDeploymentSession(request,user.id))throw new AiFailure('다시 로그인하고 계정 승인 상태를 확인해 주세요.',401);owner=user.id;
 }
 if(!(request.method==='GET'?reads:writes).allow(owner))throw new AiFailure('요청이 많아요. 잠시 후 다시 이용해 주세요.',429);
 return {owner,isKey,token};
}
export async function waitAi(owner:string,id:string,seconds=120){
 const deadline=Date.now()+seconds*1000;
 while(Date.now()<deadline){const {job}=await aiJson('jobs/'+id,owner);if(job.state==='succeeded')return job.result;if(['failed','cancelled','deleted'].includes(job.state))throw new AiFailure(job.error||'AI 작업이 중단됐어요. 작업 목록에서 확인해 주세요.',502);await new Promise(resolve=>setTimeout(resolve,1500))}
 throw new AiFailure('사용 가능한 GPU를 기다리고 있어요. /ai의 작업 목록에서 이어서 확인할 수 있어요.',503);
}
export function aiUserClient(token:string){return createClient(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}})}
