import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {VerifiedSharedSession} from './sharedSessionBroker';
type AuthClient={auth:Pick<SupabaseClient['auth'],'getUser'|'refreshSession'>};
/** One process-wide broker serializes refreshes before the browser SDK's refresh margin. */
export function createSharedSessionVerifier(makeClient:()=>AuthClient){
 const refreshes=new Map<string,{until:number;promise:Promise<VerifiedSharedSession>}>();
 const verified=new Map<string,{until:number;promise:Promise<VerifiedSharedSession>}>();
 return async function verify(value:string):Promise<VerifiedSharedSession>{
  const session=JSON.parse(value);
  if(!session||typeof session.access_token!=='string'||session.access_token.length>16_000||typeof session.refresh_token!=='string'||session.refresh_token.length<10||session.refresh_token.length>4096)throw Error('Invalid session');
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1]||'','base64url').toString('utf8'));
  if(typeof claims.sub!=='string'||!Number.isFinite(claims.exp))throw Error('Invalid session');
  const client=makeClient();
  const canonical=async(access:string,refresh:string,expiresAt:number)=>{
   const result=await client.auth.getUser(access),user=result.data.user;
   if(result.error||!user||user.id!==claims.sub)throw Error('Invalid session');
   return {value:JSON.stringify({access_token:access,refresh_token:refresh,token_type:'bearer',expires_at:expiresAt,expires_in:Math.max(0,expiresAt-Math.floor(Date.now()/1000)),user}),expiresAt};
  };
  if(claims.exp>Math.floor(Date.now()/1000)+120){
   const key=createHash('sha256').update(session.access_token+'\0'+session.refresh_token).digest('hex');
   const cached=verified.get(key);if(cached&&cached.until>Date.now())return cached.promise;
   const promise=canonical(session.access_token,session.refresh_token,claims.exp);
   verified.set(key,{until:Date.now()+5000,promise});while(verified.size>1000)verified.delete(verified.keys().next().value!);
   try{return await promise}catch(error){verified.delete(key);throw error}
  }
  const digest=createHash('sha256').update(session.refresh_token).digest('hex');
  const cached=refreshes.get(digest);if(cached&&cached.until>Date.now())return cached.promise;
  const promise=(async()=>{const result=await client.auth.refreshSession({refresh_token:session.refresh_token}),next=result.data.session;if(result.error||!next||next.user.id!==claims.sub||!Number.isFinite(next.expires_at))throw Error('Refresh unavailable');return canonical(next.access_token,next.refresh_token,next.expires_at!);})();
  refreshes.set(digest,{until:Date.now()+10_000,promise});while(refreshes.size>2000)refreshes.delete(refreshes.keys().next().value!);
  try{return await promise}catch(error){refreshes.delete(digest);throw error}
 };
}
