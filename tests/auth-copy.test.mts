import test from'node:test';import assert from'node:assert/strict';import{authErrorMessage}from'../src/lib/authCopy.ts';
test('authentication recovery explains next action without leaking raw provider/SQL details',()=>{
 assert.match(authErrorMessage({code:'invalid_credentials',message:'SELECT private.secret'},'login'),/이메일 또는 비밀번호/);
 assert.match(authErrorMessage({code:'otp_expired'},'reset'),/새 링크/);
 assert.match(authErrorMessage({status:429},'recovery'),/조금 뒤/);
 assert.doesNotMatch(authErrorMessage({message:'private database implementation'},'signup'),/private|database/);
 assert.equal(authErrorMessage({code:'user_not_found'},'login'),authErrorMessage({code:'invalid_credentials'},'login'));
});
