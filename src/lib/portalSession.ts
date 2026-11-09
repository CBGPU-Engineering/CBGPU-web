/** Select browser credentials for an already authenticated, server-side portal session.
 * Decoding here is only for matching; the portal and resource APIs verify authorization.
 */
export type PortalBrowserSession={access_token:string;user:{id:string}};
export type PortalSessionGate={user_id:string;auth_session_id?:string;session?:{access_token:string;refresh_token:string}|null};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
export function authSessionId(token:string):string|null{
 try{const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const claims=JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,'=')));return uuid(claims.session_id)?claims.session_id:null}catch{return null}
}
export function portalAuthSessionId(gate:PortalSessionGate):string|null{
 return uuid(gate.auth_session_id)?gate.auth_session_id:gate.session?.access_token?authSessionId(gate.session.access_token):null;
}
export function matchesPortalSession<S extends PortalBrowserSession>(session:S|null,userId:string,sessionId:string|null):session is S{
 return !!session&&!!sessionId&&session.user.id===userId&&authSessionId(session.access_token)===sessionId;
}
export async function reconcilePortalSession<S extends PortalBrowserSession>(gate:PortalSessionGate,client:{getSession:()=>Promise<S|null>;setSession:(tokens:{access_token:string;refresh_token:string})=>Promise<S|null>}):Promise<S>{
 const sessionId=portalAuthSessionId(gate);
 if(!uuid(gate.user_id)||!sessionId)throw Error('Portal sign-in could not be verified.');
 let session:S|null=null;
 // A stale refresh token must not stop restoration of the newly verified portal login.
 try{session=await client.getSession()}catch{}
 if(matchesPortalSession(session,gate.user_id,sessionId))return session!;
 if(!gate.session?.access_token||!gate.session.refresh_token)throw Error('Please sign in to the portal again.');
 session=await client.setSession(gate.session);
 if(!matchesPortalSession(session,gate.user_id,sessionId))throw Error('Portal session does not match the signed-in account.');
 return session!;
}
