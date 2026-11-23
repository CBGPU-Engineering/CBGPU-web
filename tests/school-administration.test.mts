import test from'node:test';import assert from'node:assert/strict';import ts from'typescript';import fs from'node:fs';import vm from'node:vm';
const module:Record<string,any>={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/schoolAdministration.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:module});
const own={id:'membership-a',user_id:'owner',school_id:'school-a',status:'ACTIVE',verified:true,school_roles:['SCHOOL_ADMIN'],school:{id:'school-a',status:'APPROVED'}};
test('inspection links preserve exact school scope without a current-school mutation',()=>{assert.equal(module.schoolAdminHref('school-b','members'),'/schools/school-b/admin?section=members');assert.equal(module.schoolAdminHref('school-a','unknown'),'/schools/school-a/admin?section=overview');assert.throws(()=>module.schoolAdminHref('../other'));assert.throws(()=>module.schoolAdminHref('school-a?school_id=school-b'))});
test('operator selector includes only own verified active school-administration memberships',()=>{for(const row of[{...own,user_id:'other'},{...own,verified:false},{...own,status:'SUSPENDED'},{...own,school_roles:['TEACHER']},{...own,school_id:'school-b'},{...own,school:{id:'school-a',status:'SUSPENDED'}}])assert.equal(module.manageableSchoolMemberships([row],'owner').length,0);assert.equal(module.manageableSchoolMemberships([own],'owner').length,1);assert.equal(module.manageableSchoolMemberships([{...own,school_roles:['SCHOOL_OWNER']}],'owner').length,1)});

test('common school-admin entry permits only own verified managers, including limited GPU operators',()=>{
 const gpu={...own,school_roles:['GPU_ADMIN']};
 assert.equal(module.schoolManagerMemberships([gpu],'owner').length,1);
 assert.equal(module.schoolManagerHome(gpu),'/schools/school-a/admin?section=gpu-reservations');
 assert.equal(module.schoolManagerHome(own),'/schools/school-a/admin?section=overview');
 for(const row of[{...own,user_id:'other'},{...own,verified:false},{...own,status:'PENDING_VERIFICATION'},{...own,school_roles:['PLATFORM_ADMIN']},{...own,school_roles:['STUDENT']},{...own,school:{id:'school-a',status:'UNCLAIMED'}}])assert.equal(module.schoolManagerMemberships([row],'owner').length,0);
});
