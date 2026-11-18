import {boundedSchoolBody} from './schoolsProxySecurity.ts';
/** Reject proxy/login HTML and bound streamed school configuration before decoding it. */
export async function schoolLifeAuthorityJson(response:Response):Promise<unknown>{
 if(!response.ok||response.redirected||!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw Error('SCHOOL_AUTHORITY_INVALID_RESPONSE');
 return JSON.parse(await boundedSchoolBody(response.body,65536));
}
