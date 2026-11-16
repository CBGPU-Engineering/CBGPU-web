import test from 'node:test';import assert from 'node:assert/strict';
import {authSessionId,matchesPortalSession,reconcilePortalSession} from '../src/lib/portalSession.ts';
const user='11111111-1111-4111-8111-111111111111',oldId='22222222-2222-4222-8222-222222222222',newId='33333333-3333-4333-8333-333333333333';
const token=(id,marker='')=>'x.'+Buffer.from(JSON.stringify({sub:user,session_id:id,marker})).toString('base64url')+'.x';
const browser=(id,marker='')=>({user:{id:user},access_token:token(id,marker)});
const gate={user_id:user,auth_session_id:newId,session:{access_token:token(newId),refresh_token:'synthetic-new-refresh'}};
test('replaces a revoked browser session for the SAME account after a new portal login',async()=>{
 let saved=browser(oldId),restores=0;const result=await reconcilePortalSession(gate,{getSession:async()=>saved,setSession:async tokens=>{restores++;assert.equal(tokens,gate.session);saved=browser(newId);return saved}});assert.equal(restores,1);assert.equal(authSessionId(result.access_token),newId);assert.equal(matchesPortalSession(browser(oldId),user,newId),false);
});
test('retains independently refreshed tokens only when the portal auth session also matches',async()=>{
 const local=browser(newId,'refreshed');assert.equal(await reconcilePortalSession({...gate,session:null},{getSession:async()=>local,setSession:async()=>assert.fail('must preserve refreshed tokens')}),local);
});
test('restores after a stale refresh-token read throws, or after another account used the browser',async()=>{
 for(const getSession of [async()=>{throw Error('revoked refresh token')},async()=>({...browser(oldId),user:{id:oldId}})]){assert.equal(authSessionId((await reconcilePortalSession(gate,{getSession,setSession:async()=>browser(newId)})).access_token),newId)}
});
test('older portals with token handoff remain compatible and mismatched restores fail closed',async()=>{
 const legacy={...gate,auth_session_id:undefined};assert.equal(authSessionId((await reconcilePortalSession(legacy,{getSession:async()=>null,setSession:async()=>browser(newId)})).access_token),newId);
 await assert.rejects(reconcilePortalSession(gate,{getSession:async()=>browser(oldId),setSession:async()=>browser(oldId)}),/does not match/);
 await assert.rejects(reconcilePortalSession({...gate,session:null},{getSession:async()=>browser(oldId),setSession:async()=>assert.fail()}),/sign in/);
 assert.equal(authSessionId('malformed'),null);
});
