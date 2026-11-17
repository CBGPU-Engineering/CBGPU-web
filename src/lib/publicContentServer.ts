import 'server-only';
import{trustedInternalServiceUrl}from'@/lib/internalServiceUrl';
import{boundedSchoolBody}from'@/lib/schoolsProxySecurity';
import{publicCollection,publicItem,publicPath,publicQuery,type PublicItem,type PublicKind}from'./publicContentModel';
export type PublicReply<T>={ok:true;data:T}|{ok:false;status:number};
export const publicBrowsingEnabled=process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1';
export async function fetchPublicContent(parts:string[],query=new URLSearchParams()):Promise<PublicReply<{items:PublicItem[];total:number}|{item:PublicItem|null}>>{
 if(!publicBrowsingEnabled||process.env.CBGPU_PUBLIC_BROWSING_V1!=='1')return{ok:false,status:404};const path=publicPath(parts),parameters=publicQuery(query);if(!path||!parameters)return{ok:false,status:404};let url:URL;
 try{url=trustedInternalServiceUrl(process.env.CBGPU_PUBLIC_CONTENT_API_URL||'http://127.0.0.1:3547',process.env.CBGPU_INTERNAL_NETWORK_MODE);url.pathname='/v1/'+parts.map(encodeURIComponent).join('/');url.search=parameters.toString();url.hash='';}catch{return{ok:false,status:503}}
 try{const response=await fetch(url,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12_000)});if(!response.ok)return{ok:false,status:[404,429].includes(response.status)?response.status:503};if(Number(response.headers.get('content-length')||0)>1_048_576)return{ok:false,status:503};const value:unknown=JSON.parse(await boundedSchoolBody(response.body,1_048_576));if(path.id){if(!value||typeof value!=='object'||!Object.hasOwn(value,'item'))return{ok:false,status:503};const raw=(value as{item:unknown}).item,item=raw===null?null:publicItem(path.kind,raw);if(raw!==null&&!item)return{ok:false,status:503};return{ok:true,data:{item}}}const collection=publicCollection(path.kind,value);return collection?{ok:true,data:collection}:{ok:false,status:503}}catch{return{ok:false,status:503}}
}
export async function publicList(kind:PublicKind,limit=24,query=''){return fetchPublicContent([kind],new URLSearchParams({limit:String(limit),query})) as Promise<PublicReply<{items:PublicItem[];total:number}>>}
export async function publicDetail(kind:Exclude<PublicKind,'community'>,id:string){return fetchPublicContent([kind,id]) as Promise<PublicReply<{item:PublicItem|null}>>}
