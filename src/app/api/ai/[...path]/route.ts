import {NextRequest,NextResponse} from 'next/server';
import {AiFailure,aiIdentity,aiInternal,aiJson,waitAi,aiUserClient} from '@/lib/aiServer';
import {aiSources} from '@/lib/aiSources';
import {readJsonBody,RequestBodyError} from '@/lib/requestSecurity';
export const runtime='nodejs';export const maxDuration=180;
let activeUploads=0;
async function audioForm(request:NextRequest){
 const maximum=201*1024*1024;if(Number(request.headers.get('content-length'))>maximum)throw new AiFailure('200 MB 이하의 파일을 올려 주세요.',413);
 const reader=request.body?.getReader();if(!reader)throw new AiFailure('파일을 넣어 주세요.');let size=0;const parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new AiFailure('200 MB 이하의 파일을 올려 주세요.',413)}parts.push(value)}
 return new Request('http://local/upload',{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:Buffer.concat(parts)}).formData();
}
const uuid=(v:string)=>/^[a-f0-9-]{36}$/.test(v);
async function handle(request:NextRequest,context:{params:Promise<{path:string[]}>}){
 try{
  const {path}=await context.params;const keyManagement=path[0]==='keys';const identity=await aiIdentity(request,!keyManagement);const {owner,token,isKey}=identity;
  if(isKey&&path[0]!=='v1')throw new AiFailure('AI API 키는 /v1의 추론 API에서 사용할 수 있어요. 작업 관리에는 계정 로그인이 필요해요.',403);
  if(path.some(p=>!/^[-a-z0-9]+$/.test(p))||path.length>4)throw new AiFailure('Not found',404);
  let body:Record<string,unknown>={};if(request.method==='POST'&&!['uploads'].includes(path[0])&&path.join('/')!=='v1/audio/transcriptions'){const value=await readJsonBody(request,3*1024*1024);if(!value||typeof value!=='object'||Array.isArray(value))throw new AiFailure('JSON 객체를 보내 주세요.');body=value as Record<string,unknown>}
  if(path.join('/')==='search'&&request.method==='POST'){
   if(isKey)throw new AiFailure('웹 자료 검색에는 계정 로그인이 필요해요.',403);
   const query=typeof body.query==='string'?body.query.trim():'';if(!query||query.length>1000)throw new AiFailure('검색할 내용을 1,000자 이내로 입력해 주세요.');
   const candidates=await aiSources(token,String(body.scope||'all'));return NextResponse.json(await aiJson('jobs',owner,'POST',{kind:'search',title:'통합 검색: '+query.slice(0,80),input:{query,candidates}}),{status:202});
  }
  if(path[0]==='materials'&&path.length===3&&uuid(path[1])&&path[2]==='summarize'&&request.method==='POST'){
   if(isKey)throw new AiFailure('자료를 열 수 있는 CBGPU 계정 로그인이 필요해요.',403);
   const client=aiUserClient(token),{data:material,error}=await client.from('shared_materials').select('id,title,file_name,status').eq('id',path[1]).eq('status','ready').maybeSingle();if(error||!material)throw new AiFailure('자료를 찾을 수 없어요.',404);
   const file=await fetch('http://127.0.0.1:8421/materials/'+path[1]+'/content',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60_000)});if(!file.ok||!file.body)throw new AiFailure('원본 파일을 읽지 못했어요.',502);
   const uploadResponse=await aiInternal('uploads',owner,'POST',undefined,file.body,'?name='+encodeURIComponent(material.file_name));const upload=await uploadResponse.json();if(!uploadResponse.ok)throw new AiFailure(upload.message||'문서가 너무 커요.',uploadResponse.status);
   return NextResponse.json(await aiJson('jobs',owner,'POST',{kind:'document',title:'자료 요약: '+material.title,input:{upload_id:upload.id}}),{status:202});
  }
  if(path[0]==='v1'){
   if(path.join('/')==='v1/models'&&request.method==='GET')return NextResponse.json({object:'list',data:['cbgpu-chat','cbgpu-embeddings','cbgpu-whisper'].map(id=>({id,object:'model',owned_by:'cbgpu'}))});
   if(path.join('/')==='v1/chat/completions'&&request.method==='POST'){
    if(body.stream)throw new AiFailure('현재는 stream: false를 사용해 주세요.');if(body.model&&body.model!=='cbgpu-chat')throw new AiFailure('model은 cbgpu-chat을 사용해 주세요.');
    const {job}=await aiJson('jobs',owner,'POST',{kind:'chat',input:{messages:body.messages,max_tokens:body.max_tokens??512},title:'API chat'});return NextResponse.json(await waitAi(owner,job.id));
   }
   if(path.join('/')==='v1/embeddings'&&request.method==='POST'){
    if(body.model&&body.model!=='cbgpu-embeddings')throw new AiFailure('model은 cbgpu-embeddings를 사용해 주세요.');const {job}=await aiJson('jobs',owner,'POST',{kind:'embed',input:{input:body.input},title:'API embeddings'});return NextResponse.json(await waitAi(owner,job.id));
   }
   if(path.join('/')==='v1/audio/transcriptions'&&request.method==='POST'){
    if(activeUploads>=2)throw new AiFailure('다른 파일을 받고 있어요. 잠시 후 다시 시도해 주세요.',429);activeUploads++;
    let upload:{id:string},language:FormDataEntryValue|null;
    try{
      const form=await audioForm(request);const file=form.get('file');language=form.get('language');if(!(file instanceof File)||file.size>200*1024*1024)throw new AiFailure('200 MB 이하의 음성 파일을 넣어 주세요.',413);
      if(form.get('model')&&form.get('model')!=='cbgpu-whisper')throw new AiFailure('model은 cbgpu-whisper를 사용해 주세요.');
      if(form.get('response_format')&&!['json','verbose_json'].includes(String(form.get('response_format'))))throw new AiFailure('현재는 JSON 전사 응답을 지원해요. SRT는 웹에서 받을 수 있어요.');
      const response=await aiInternal('uploads',owner,'POST',undefined,file.stream(),'?name='+encodeURIComponent(file.name));const data=await response.json();if(!response.ok)throw new AiFailure(data.message||'파일을 받지 못했어요.',response.status);upload=data;
    }finally{activeUploads--}
    const {job}=await aiJson('jobs',owner,'POST',{kind:'transcribe',input:{upload_id:upload.id,language},title:'API transcription'});const result=await waitAi(owner,job.id);return NextResponse.json({text:result.text});
   }
   throw new AiFailure('지원하지 않는 AI API 경로입니다.',404);
  }
  const allowed=path.length===1&&['status','jobs','keys','uploads'].includes(path[0])||path.length===2&&['jobs','keys','downloads'].includes(path[0])&&uuid(path[1])||path.length===3&&path[0]==='jobs'&&uuid(path[1])&&['cancel','retry','artifact','download'].includes(path[2]);
  if(!allowed)throw new AiFailure('Not found',404);
  if(path[0]==='uploads'){
   if(request.method!=='POST')throw new AiFailure('Method not allowed',405);
   if(activeUploads>=2)throw new AiFailure('다른 파일을 받고 있어요. 잠시 후 다시 시도해 주세요.',429);activeUploads++;
   try{const response=await aiInternal('uploads',owner,'POST',undefined,request.body,'?name='+encodeURIComponent(request.nextUrl.searchParams.get('name')||'upload'));return new NextResponse(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}finally{activeUploads--}
  }
  if(path[0]==='jobs'&&path.length===1&&request.method==='POST'&&isKey&&body.kind==='python')throw new AiFailure('GPU 코드 실행에는 CBGPU 계정 로그인이 필요해요.',403);
  const query=path[2]==='artifact'?'?path='+encodeURIComponent(request.nextUrl.searchParams.get('path')||''):'';
  const response=await aiInternal(path.join('/'),owner,request.method,request.method==='POST'?body:undefined,undefined,query);
  if(path[2]==='artifact'||path[0]==='downloads')return new NextResponse(response.body,{status:response.status,headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent((request.nextUrl.searchParams.get('path')||'output').split('/').pop()!),'Cache-Control':'no-store'}});
  const result=await response.json();
  if(response.ok&&request.method==='GET'&&result.job?.kind==='search'&&result.job?.result?.hits){if(isKey)throw new AiFailure('웹 검색 결과에는 CBGPU 계정 로그인이 필요해요.',403);const current=new Map((await aiSources(token)).map(s=>[s.id,s]));result.job.result.hits=result.job.result.hits.filter((h:{id:string})=>current.has(h.id)).map((h:{id:string;score:number;snippet?:string})=>({...current.get(h.id),snippet:/^(material|paper):/.test(h.id)&&typeof h.snippet==='string'?h.snippet.slice(0,350):current.get(h.id)?.snippet,score:h.score,text:undefined}))}
  return NextResponse.json(result,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch(error){const status=error instanceof AiFailure?error.status:error instanceof RequestBodyError?error.status:503;return NextResponse.json({message:error instanceof AiFailure?error.message:'AI 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'},{status,headers:{'Cache-Control':'no-store'}})}
}
async function route(request:NextRequest,context:{params:Promise<{path:string[]}>}){const response=await handle(request,context);response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex, nofollow');return response}
export {route as GET,route as POST,route as DELETE};
