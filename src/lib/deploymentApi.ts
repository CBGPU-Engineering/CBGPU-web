import {supabase} from './supabase';
import {deploymentResponse} from './deploymentResponse';
export async function deploymentApi(path:string,method='GET',body?:unknown){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error('로그인이 필요합니다.');
 // Bound both response headers and body; never retry a mutation automatically.
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch('/api/deploy/'+path,{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal});
  return await deploymentResponse(response);
 }catch(error){
  if(controller.signal.aborted)throw new Error('응답을 기다리는 시간이 길어졌어요. 목록에서 처리 상태를 확인한 뒤 다시 시도해 주세요.');
  if(error instanceof TypeError)throw new Error('배포 서비스에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
  throw error;
 }finally{clearTimeout(timer)}
}
export async function serverProjectRequest(id?:string,updates?:Record<string,unknown>,remove=false){try{const data=await deploymentApi('servers/projects'+(id?'/'+id:''),remove?'DELETE':updates?(id?'PATCH':'POST'):'GET',updates);return{data:id||updates?data.project:data.projects,error:null,deployment_requested:typeof data.deployment_requested==='boolean'?data.deployment_requested:undefined,warning:typeof data.warning==='string'?data.warning:null}}catch(e){return{data:null,error:{message:e instanceof Error?e.message:'서버를 불러오지 못했습니다.',code:''},deployment_requested:undefined,warning:null}}}
