import 'server-only';
import {readFile} from 'node:fs/promises';
import {studioAuthorityCore} from './studioAuthorityCore';
/** Credentials remain on the trusted first-party web host, never in the project container. */
export async function studioAuthority(token:string,projectId:string){
 return studioAuthorityCore(token,projectId,{env:process.env,fetcher:fetch,deployKey:async()=>(await readFile(process.env.CBGPU_FRONTEND_DEPLOY_KEY_FILE||'/home/cbgpu/CBGPU-live/backend/private/frontend-deploy-key')).toString('hex')});
}
