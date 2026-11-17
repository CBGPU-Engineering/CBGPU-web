import 'server-only';
import{trustedInternalServiceUrl}from'./internalServiceUrl';
import{publicContestBannerPath}from'./publicContentModel';
export const PUBLIC_IMAGE_LIMIT=10*1024*1024;
let activeTransfers=0;
export const publicImageHeaders={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
export const publicBannerPath=publicContestBannerPath;
export function publicImageMagic(mime:string,bytes:Uint8Array){if(mime==='image/png')return bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&new TextDecoder().decode(bytes.slice(12,16))==='IHDR';if(mime==='image/jpeg')return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;if(mime==='image/webp')return bytes.length>=16&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(new TextDecoder().decode(bytes.slice(12,16)));return false}
export async function fetchPublicBanner(id:string):Promise<Response>{
 const denied=(status=404)=>new Response(null,{status,headers:publicImageHeaders});
 if(process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1!=='1'||process.env.CBGPU_PUBLIC_BROWSING_V1!=='1'||!publicBannerPath(id))return denied();
 if(activeTransfers>=8)return denied(429);
 activeTransfers++;let transferred=false,released=false;
 const release=()=>{if(!released){released=true;activeTransfers--}};
 try{
  const url=trustedInternalServiceUrl(process.env.CBGPU_PUBLIC_CONTENT_API_URL||'http://127.0.0.1:3547',process.env.CBGPU_INTERNAL_NETWORK_MODE);url.pathname=`/v1/assets/contests/${id}/banner`;url.search='';url.hash='';
  // Never forward the visitor's Cookie, Authorization, URL, Range or credentials.
  const response=await fetch(url,{headers:{Accept:'image/png,image/jpeg,image/webp'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15_000)});
  const refuse=async(status=404)=>{await response.body?.cancel().catch(()=>{});return denied(status)};
  if(response.status!==200)return refuse(response.status===429?429:response.status===503?503:404);
  const mime=response.headers.get('content-type')?.split(';')[0].trim()||'';
  if(!['image/png','image/jpeg','image/webp'].includes(mime)||response.headers.has('content-encoding'))return refuse();
  const advertised=response.headers.get('content-length');if(advertised!==null&&(!/^\d+$/.test(advertised)||Number(advertised)>PUBLIC_IMAGE_LIMIT||Number(advertised)<1))return refuse();
  const reader=response.body?.getReader();if(!reader)return denied();const chunks:Uint8Array[]= [];let total=0;
  try{while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>PUBLIC_IMAGE_LIMIT){await reader.cancel();return denied()}chunks.push(value)}}finally{reader.releaseLock()}
  if(total<1||advertised!==null&&total!==Number(advertised))return denied();const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  if(!publicImageMagic(mime,bytes))return denied();
  let position=0;
  const body=new ReadableStream<Uint8Array>({pull(controller){if(position>=bytes.length){controller.close();release();return}const end=Math.min(position+65536,bytes.length);controller.enqueue(bytes.subarray(position,end));position=end},cancel(){release()}});
  const result=new Response(body,{headers:{...publicImageHeaders,'Content-Type':mime,'Content-Length':String(total)}});transferred=true;return result;
 }catch{return denied(503)}finally{if(!transferred)release()}
}
