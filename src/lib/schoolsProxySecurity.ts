export function schoolRequestOriginAllowed(host:string,origin:string|null,headers?:{get(name:string):string|null}){if(!origin)return headers?isNativeBearerRequest(headers):false;const localhost=/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host);if(localhost)return origin==='http://'+host||origin==='https://'+host;return ['cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com','admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(host)&&origin==='https://'+host}
export async function boundedSchoolBody(stream:ReadableStream<Uint8Array>|null,maximum=131072){if(!stream)return '';const reader=stream.getReader(),chunks:Uint8Array[]=[];let bytes=0;try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maximum){await reader.cancel();throw Error('BODY_TOO_LARGE')}chunks.push(value)}const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder('utf-8',{fatal:true}).decode(body)}finally{reader.releaseLock()}}

type HeaderReader = { get(name: string): string | null };
/**
 * Browser writes must come from our own pages, which is what the per-route Origin checks enforce (CSRF defence).
 * A native app is not a browser: it sends no Origin, has no cookies, and authenticates with a Bearer token in a
 * header. Cross-site forgery needs ambient credentials (cookies) a browser attaches by itself, and a custom
 * Authorization header cannot be attached cross-site without a CORS preflight, so a request that has NO Origin,
 * NO cookie and NO browser fetch metadata but a Bearer token cannot be forged by a web page.
 *
 * Rule for every write route:
 *   - Origin present  -> it must still be one of ours (unchanged; browsers always send it on cross-site writes)
 *   - Origin missing  -> allowed only for a bearer-only, non-browser request
 */
export function isNativeBearerRequest(headers: HeaderReader): boolean {
  if (headers.get('origin') || headers.get('cookie')) return false;
  // Browsers add Sec-Fetch-* to every request; an app does not. Their presence means "treat as a browser".
  if (headers.get('sec-fetch-site') || headers.get('sec-fetch-mode') || headers.get('sec-fetch-dest')) return false;
  const bearer = headers.get('authorization');
  if (bearer && /^Bearer [^\s,]{1,32768}$/i.test(bearer)) return true;
  const studyToken = headers.get('x-cbgpu-auth');
  return !!studyToken && /^(Bearer )?[^\s,]{1,32768}$/i.test(studyToken);
}

/** `sameOrigin` is the route's existing browser check for a present Origin. */
export function writeOriginAllowed(origin: string | null, headers: HeaderReader, sameOrigin: (origin: string) => boolean): boolean {
  return origin ? sameOrigin(origin) : isNativeBearerRequest(headers);
}
