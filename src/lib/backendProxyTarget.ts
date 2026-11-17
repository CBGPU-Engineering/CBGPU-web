import {trustedInternalServiceUrl} from './internalServiceUrl';
/** Operator-configured backend only; the request can select a known API path, never an origin. */
export function backendProxyTarget(path:string,search:string,configured:string|undefined,mode?:string):URL|null {
 if(!configured||!/^\/backend\/(auth|rest|storage|realtime|functions)\/v1(?:\/|$)/.test(path))return null;
 const base=trustedInternalServiceUrl(configured,mode);
 if(base.pathname!=='/'||base.search||base.hash)throw Error('Backend proxy URL must be an origin');
 if(/[\\\u0000-\u0020\u007f]/.test(path)||/%(?:2f|5c|00|0a|0d)/i.test(path)||path.split('/').some(p=>p==='.'||p==='..'))throw Error('Invalid backend API path');
 const service=path.split('/')[2];
 let decoded=path;for(let round=0;round<4;round++){if(decoded.split('/').some(p=>p==='.'||p==='..')||/[\\\u0000-\u001f\u007f]/.test(decoded))throw Error('Invalid backend API path');const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;if(round===3)throw Error('Ambiguous backend API path');}
 base.pathname=path.slice('/backend'.length);if(!base.pathname.startsWith('/'+service+'/v1/')&&base.pathname!=='/'+service+'/v1')throw Error('Invalid backend API path');base.search=search;return base;
}
