/** Scoped file reads use the current SDK bearer and Storage RLS, never a signed capability. */
export type FileReadClient={auth:{getSession:()=>PromiseLike<{data:{session:{user:{id:string}}|null};error?:unknown}>};storage:{from:(bucket:string)=>{download:(path:string)=>PromiseLike<{data:Blob|null;error:{message?:string;status?:unknown;statusCode?:unknown}|null}>}}};
export const scopedManufacturingFilesEnabled=()=>process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'||['1','true'].includes(process.env.NEXT_PUBLIC_CBGPU_ACCOUNT_V2||'');
export class ManufacturingFileError extends Error{status:number;constructor(message:string,status=503){super(message);this.status=status}}
const changed=()=>new ManufacturingFileError('CBGPU 계정이나 파일이 변경되었습니다. 현재 신청에서 다시 열어 주세요.',409);
const denied=(status:number)=>new ManufacturingFileError(status===401?'CBGPU에 다시 로그인한 뒤 파일을 열어 주세요.':'현재 파일 접근 권한을 확인하지 못했습니다. 신청 내역은 유지돼요. 다시 불러오거나 담당자에게 문의해 주세요.',status===401?401:status===403||status===404?403:503);
/** Each instance owns only its own object URLs; invalidate on path/identity changes and unmount. */
export class ManufacturingFileLease{
 private generation=0;private urls=new Set<string>();
 constructor(private objectUrls:{createObjectURL:(blob:Blob)=>string;revokeObjectURL:(url:string)=>void}=URL){}
 invalidate(){this.generation++;for(const url of this.urls)this.objectUrls.revokeObjectURL(url);this.urls.clear();}
 release(url:string){if(this.urls.delete(url))this.objectUrls.revokeObjectURL(url);}
 private async read(client:FileReadClient,viewer:string,path:string,current:()=>boolean){
  try{
  const generation=this.generation,live=()=>generation===this.generation&&current();
  if(!viewer||!path||!live())return null;
  const before=await client.auth.getSession();if(!live())return null;if(before.error)throw denied(503);if(before.data.session?.user.id!==viewer)throw denied(401);
  const result=await client.storage.from('manufacturing').download(path);if(!live())return null;
  if(result.error)throw denied(Number(result.error.statusCode??result.error.status??503));
  if(!(result.data instanceof Blob))throw denied(503);
  const after=await client.auth.getSession();if(!live())return null;if(after.error)throw denied(503);if(after.data.session?.user.id!==viewer)throw changed();
  return result.data;
  }catch(error){if(error instanceof ManufacturingFileError)throw error;throw denied(503);}
 }
 private url(blob:Blob,current:()=>boolean){const value=this.objectUrls.createObjectURL(blob);this.urls.add(value);if(!current()){this.release(value);return null;}return value;}
 async preview(client:FileReadClient,viewer:string,path:string,current:()=>boolean){const generation=this.generation;const blob=await this.read(client,viewer,path,current);return blob?this.url(blob,()=>generation===this.generation&&current()):null;}
 /** Always fetch again on USER click. Never reuse the preview's already-read bytes. */
 async download(client:FileReadClient,viewer:string,path:string,current:()=>boolean){const generation=this.generation;const blob=await this.read(client,viewer,path,current);return blob?this.url(blob,()=>generation===this.generation&&current()):null;}
}

/** Portal Storage URLs may point at the main host. Keep private bytes on this origin,
 * with the current SDK bearer; never use main-site cookies or signed capabilities. */
export function sameOriginManufacturingFileClient(client:{auth:{getSession:()=>PromiseLike<{data:{session:{user:{id:string};access_token?:string}|null};error?:unknown}>}},request:typeof fetch=fetch,expectedViewer?:string):FileReadClient{
 return{auth:client.auth,storage:{from:(bucket:string)=>({download:async(path:string)=>{
  if(bucket!=='manufacturing')return{data:null,error:{status:403}};
  const session=await client.auth.getSession();
  const token=session.data.session?.access_token;
  if(session.error||!token||!expectedViewer||session.data.session?.user.id!==expectedViewer)return{data:null,error:{status:session.error?503:401}};
  const response=await request('/api/manufacturing/file-read?'+new URLSearchParams({key:path}),{method:'GET',headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error'});
  if(!response.ok){await response.body?.cancel();return{data:null,error:{status:response.status}};}
  return{data:await response.blob(),error:null};
 }})}};
}
