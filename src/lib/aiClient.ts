import {getNativeBridge} from './nativeBridge';
import {supabase} from './supabase';
export type AiJob={id:string;kind:string;title:string;state:'queued'|'running'|'paused'|'succeeded'|'failed'|'cancelled';created:number;updated:number;gpu:number|null;attempts:number;progress:string;error?:string;logs?:string;artifacts?:{path:string;size:number}[];result?:{text?:string;srt?:string;language?:string;truncated?:boolean;choices?:{message:{content:string};finish_reason?:string}[];hits?:{id:string;label:string;href:string;snippet:string;score:number}[]}};
export async function aiRequest(path:string,method='GET',body?:unknown,signal?:AbortSignal,expectedUserId?:string,timeoutMs=30_000):Promise<any>{
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('CBGPU 계정으로 로그인해 주세요.');if(expectedUserId&&session.user.id!==expectedUserId)throw Error('계정이 바뀌었어요. 다시 시도해 주세요.');
 if(signal?.aborted)throw new DOMException('취소됨','AbortError');
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 const file=body instanceof File;
 const timer=setTimeout(()=>controller.abort(),file?Math.max(timeoutMs,120_000):timeoutMs);
 try{
  const response=await fetch('/api/ai'+path,{method,headers:{Authorization:'Bearer '+session.access_token,...(file?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:file?body as File:JSON.stringify(body),cache:'no-store',signal:controller.signal});
  const result:unknown=await response.json().catch(()=>null);
  const record=result!==null&&typeof result==='object'&&!Array.isArray(result)?result as Record<string,any>:null;
  if(!response.ok)throw Object.assign(Error(typeof record?.message==='string'&&record.message.length<=1000?record.message:`AI 서비스에 연결하지 못했어요 (${response.status}). 잠시 후 다시 확인해 주세요.`),{status:response.status});
  if(!record)throw Error('AI 서비스 응답을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
  return record;
 }catch(error){
  if(signal?.aborted)throw new DOMException('취소됨','AbortError');
  if(controller.signal.aborted)throw Error('AI 응답이 늦어지고 있어요. 내 작업에서 처리 상태를 확인해 주세요.');
  if(error instanceof TypeError)throw Error('AI 서비스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  throw error;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
}
export async function waitForAiJob(id:string,options:{signal?:AbortSignal;onProgress?:(job:AiJob)=>void;timeout?:number}={}){
 const deadline=Date.now()+(options.timeout??180_000);
 while(Date.now()<deadline){
  if(options.signal?.aborted)throw new DOMException('취소됨','AbortError');
  const {job}: {job:AiJob}=await aiRequest('/jobs/'+id,'GET',undefined,options.signal,undefined,Math.min(30_000,Math.max(1,deadline-Date.now())));if(!job||job.id!==id||!['queued','running','paused','succeeded','failed','cancelled'].includes(job.state))throw Error('작업 상태를 확인하지 못했어요. AI 작업 목록에서 다시 확인해 주세요.');options.onProgress?.(job);
  if(job.state==='succeeded')return job;
  if(['failed','cancelled'].includes(job.state))throw Error(job.error||'작업이 중단됐어요. AI 작업 목록에서 확인해 주세요.');
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{options.signal?.removeEventListener('abort',abort);resolve()},Math.min(2500,Math.max(1,deadline-Date.now())));const abort=()=>{clearTimeout(timer);reject(new DOMException('취소됨','AbortError'))};options.signal?.addEventListener('abort',abort,{once:true})});
 }
 throw Error('GPU를 기다리고 있어요. AI → 내 작업에서 계속 확인할 수 있어요.');
}
export async function aiDownload(path:string,filename:string){const bridge=getNativeBridge();if(bridge){const match=path.match(/^\/jobs\/([a-f0-9-]{36})\/artifact/);if(!match)throw Error('다운로드 경로를 확인해 주세요.');const value=await aiRequest('/jobs/'+match[1]+'/download','POST',{kind:'artifact',path:new URL('http://local'+path).searchParams.get('path')});const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('로그인이 필요해요.');await bridge.downloadMaterial({id:value.id,fileName:filename,accessToken:session.access_token});return}const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('로그인이 필요해요.');const response=await fetch('/api/ai'+path,{headers:{Authorization:'Bearer '+session.access_token}});if(!response.ok)throw Error('파일을 받지 못했어요.');saveAiBlob(await response.blob(),filename)}
export function saveAiBlob(value:Blob|string,name:string){const url=URL.createObjectURL(value instanceof Blob?value:new Blob([value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export async function aiResultDownload(id:string,kind:'text'|'srt',filename:string,text:string){const bridge=getNativeBridge();if(!bridge){saveAiBlob(text,filename);return}const value=await aiRequest('/jobs/'+id+'/download','POST',{kind});const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('로그인이 필요해요.');await bridge.downloadMaterial({id:value.id,fileName:filename,accessToken:session.access_token})}
