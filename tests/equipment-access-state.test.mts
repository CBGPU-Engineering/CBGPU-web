import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync(new URL('../src/lib/equipmentAccessState.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {equipmentAccessView}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const base={isLoading:false,authTimedOut:false,signedIn:true,access:'allowed',permittedDetail:true};
test('signed-out users do not remain in the initial permission loading state',()=>{
 assert.equal(equipmentAccessView({...base,signedIn:false,access:'loading'}),'sign-in');
 assert.equal(equipmentAccessView({...base,access:'unauthenticated'}),'sign-in');
});
test('authentication and permission failures leave loading without granting access',()=>{
 assert.equal(equipmentAccessView({...base,isLoading:true}),'loading');
 assert.equal(equipmentAccessView({...base,isLoading:true,authTimedOut:true}),'error');
 assert.equal(equipmentAccessView({...base,access:'error'}),'error');
 assert.equal(equipmentAccessView({...base,access:'denied'}),'denied');
 assert.equal(equipmentAccessView({...base,permittedDetail:false}),'denied');
 assert.equal(equipmentAccessView(base),'allowed');
});
