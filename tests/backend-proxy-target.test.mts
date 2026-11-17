import test from'node:test';import assert from'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import{trustedInternalServiceUrl}from'../src/lib/internalServiceUrl.ts';
const api:any={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/backendProxyTarget.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,URL,decodeURIComponent,require:(name:string)=>{assert.equal(name,'./internalServiceUrl');return{trustedInternalServiceUrl}}});const{backendProxyTarget}=api;
test('runtime configuration changes backend origin without changing public paths or authority',()=>{
 const target=backendProxyTarget('/backend/rest/v1/projects','?select=id','https://kong.services.internal','private-container');
 assert.equal(target?.href,'https://kong.services.internal/rest/v1/projects?select=id');
 assert.equal(backendProxyTarget('/backend/realtime/v1/websocket','?apikey=public','http://127.0.0.1:54321')?.pathname,'/realtime/v1/websocket');
 assert.equal(backendProxyTarget('/backend/rest/v1/projects','',undefined),null);
 for(const path of ['/api/auth/shared-session','/backend/studio','/backend/pg/v1/users'])assert.equal(backendProxyTarget(path,'','http://localhost:54321'),null);
});
test('backend path/origin confusion and unknown public upstreams are rejected',()=>{
 for(const path of ['/backend/rest/v1/../auth','/backend/rest/v1/%2e%2e/%2e%2e/studio','/backend/rest/v1/%252e%252e/auth','/backend/rest/v1/%2f%2fevil','/backend/rest/v1/\\evil'])assert.throws(()=>backendProxyTarget(path,'','http://localhost:54321'));
 for(const origin of ['https://evil.example','http://user:pass@localhost:54321','http://localhost:54321/other','http://localhost:54321/?target=evil'])assert.throws(()=>backendProxyTarget('/backend/rest/v1/projects','',origin));
});
