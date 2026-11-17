/** Navigation context only. Never resumes a write, cost-incurring action or queued callback. */
export function safeAuthReturn(value:unknown,fallback='/'){
 if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//'))return fallback;
 let decoded=value;try{for(let round=0;round<8;round++){if(/[\\\u0000-\u001f\u007f-\u009f]/.test(decoded)||decoded.startsWith('//'))return fallback;if(!/%[0-9a-f]{2}/i.test(decoded))break;const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;if(round===7)return fallback;}
 const url=new URL(value,'https://cbgpu.com');if(url.origin!=='https://cbgpu.com'||url.username||url.password||/^\/(api|backend|_next|auth)(\/|$)/i.test(decodeURIComponent(url.pathname)))return fallback;
 for(const key of url.searchParams.keys())if(/^(access.?token|refresh.?token|token|password|authorization|session|answers?|code)(\b|\[|_)/i.test(key))return fallback;
 if(url.hash&&!/^#[a-z0-9-]{1,100}$/i.test(url.hash))return fallback;
 return url.pathname+url.search+url.hash;
 }catch{return fallback}
}
