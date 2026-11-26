import test from'node:test';import assert from'node:assert/strict';
import{manufacturingProfiles,contestOperatorProfiles,manufacturingJobSelect}from'../src/lib/scopedProfiles.ts';
const id='11111111-1111-4111-8111-111111111111';
test('V1 fabrication denial never retries a raw global profile query',async()=>{let calls=0;const denied={data:null,error:{message:'FORBIDDEN',code:'42501'}},client={rpc:async(name:string,args:Record<string,unknown>)=>{calls++;assert.equal(name,'cbgpu_manufacturing_profiles');assert.deepEqual(args,{p_kind:'print',p_user_ids:[id]});return denied},from:()=>{throw Error('raw profile fallback')}};assert.deepEqual(await manufacturingProfiles(client,'print',[id,id],true),denied);assert.equal(calls,1);assert.equal(manufacturingJobSelect('',true),'*');assert.equal(manufacturingJobSelect(', preferred_printer:preferred_printer_id(name)',false),'*, manager:manager_id(full_name, student_id), preferred_printer:preferred_printer_id(name)')});
test('exact operator lookup is contest-bound and propagates authorization failure',async()=>{const client={rpc:async(name:string,args:Record<string,unknown>)=>{assert.equal(name,'cbgpu_contest_operator_profiles');assert.deepEqual(args,{p_contest:id,p_user_ids:null,p_student_number:'2301'});return{data:null,error:{message:'SCHOOL_OPERATOR_LOOKUP_DENIED'}}},from:()=>{throw Error('raw fallback')}};assert.equal((await contestOperatorProfiles(client,id,null,' 2301 ',true)).error?.message,'SCHOOL_OPERATOR_LOOKUP_DENIED')});
test('V1 never broadens empty ids and retains only scoped response labels',async()=>{let calls=0;const client={rpc:async()=>{calls++;return{data:[{id,full_name:'Scoped label',student_id:null}],error:null}},from:()=>{throw Error('raw fallback')}};assert.deepEqual(await manufacturingProfiles(client,'laser',[],true),{data:[],error:null});assert.equal(calls,0);assert.equal((await contestOperatorProfiles(client,id,[id],null,true)).data?.[0].student_id,null)});
test('flag-off retains legacy profiles path without calling candidate RPC',async()=>{
 let called=false;
 const client={
  rpc:async()=>{throw Error('candidate RPC flag off')},
  from:(table:string)=>{
   assert.equal(table,'profiles');
   return {select:(columns:string)=>{
    assert.equal(columns,'id, full_name, student_id');
    return {in:async(column:string,values:string[])=>{
     called=true;assert.equal(column,'id');assert.deepEqual(values,[id]);return {data:[],error:null};
    }};
   }};
  }
 };
 assert.deepEqual(await manufacturingProfiles(client,'laser',[id],false),{data:[],error:null});assert.equal(called,true);
});

test('new global/public V1 entrant never inherits a primary-school student number',async()=>{const{initialContestStudentNumber,canShareContestStudentNumber}=await import('../src/lib/scopedProfiles.ts');assert.equal(initialContestStudentNumber(null,'CBsh-private-number',true),'');assert.equal(initialContestStudentNumber('historical-snapshot','CBsh-private-number',true),'historical-snapshot');assert.equal(initialContestStudentNumber(null,'legacy-number',false),'legacy-number');assert.equal(canShareContestStudentNumber('',false,false,true),true);assert.equal(canShareContestStudentNumber('voluntarily-entered',false,false,true),false);assert.equal(canShareContestStudentNumber('voluntarily-entered',true,false,true),true);assert.equal(canShareContestStudentNumber('ignored-on-team',false,true,true),true)});
test('manager labels and study member labels use dedicated projections, never profile fallback',async()=>{const{manufacturingManagers,attachManufacturingManagers,studyMemberProfiles}=await import('../src/lib/scopedProfiles.ts');const calls:any[]=[],client={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return{data:null,error:{message:'SCOPE_REVOKED',code:'42501'}}},from:()=>{throw Error('raw fallback')}};assert.equal((await manufacturingManagers(client,'laser',null,null,true)).error?.code,'42501');assert.deepEqual(calls[0],{name:'cbgpu_manufacturing_managers',args:{p_kind:'laser',p_printer_id:null,p_user_ids:null}});const rows=await attachManufacturingManagers(client,'print',[{id,user_id:id,manager_id:id,manager:{full_name:'STALE PRIVATE LABEL'}}],true);assert.equal(rows.data[0].manager,null);assert.equal(rows.error?.code,'42501');assert.equal((await studyMemberProfiles(client,[id],true)).error?.code,'42501');assert.equal(calls.at(-1).name,'cbgpu_study_member_profiles')});
test('name-only manager and study DTOs still discard raw photo URLs and primary-school numbers (avatars arrive only via the avatar-only lookup)',async()=>{const{manufacturingManagers,studyMemberProfiles}=await import('../src/lib/scopedProfiles.ts');const client={rpc:async()=>({data:[{id,full_name:'Permitted name',student_id:'PRIVATE_PRIMARY_NUMBER',avatar_url:'PRIVATE_AVATAR'}],error:null}),from:()=>{throw Error('raw fallback')}};for(const result of[await manufacturingManagers(client,'print',[id],1,true),await studyMemberProfiles(client,[id],true)])assert.deepEqual(result.data,[{id,full_name:'Permitted name',student_id:null}])});

test('study members across schools show an avatar but nothing else new (avatarUrl is the only value that crosses)',async()=>{
 const{memberAvatarUrls,withMemberAvatars}=await import('../src/lib/scopedProfiles.ts');
 const other='22222222-2222-4222-8222-222222222222',calls:{name:string;args:Record<string,unknown>}[]=[];
 const avatar='https://api.dicebear.com/9.x/thumbs/png?seed=2fb88268-1ec6-4729-b66f-a5ae130703cb&size=256';
 // A server that over-shares must not widen what the screen keeps.
 const client={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return{data:[{id,avatarUrl:avatar,full_name:'LEAK',student_id:'LEAK',school_id:'LEAK'},{id:other,avatarUrl:'https://files.example/a.jpg',full_name:'LEAK'}],error:null}},from:()=>{throw Error('raw profile fallback')}};
 const avatars=await memberAvatarUrls(client as never,[id,other,id,'not-a-uuid']);
 assert.deepEqual(calls,[{name:'cbgpu_avatar_urls',args:{p_user_ids:[id,other]}}],'one avatar-only RPC, de-duplicated, invalid ids dropped');
 assert.equal(avatars.get(id),avatar);
 // the viewer's school rules only allowed the first name: the other member keeps no name but still has an avatar
 const people=withMemberAvatars([{id,full_name:'Visible name',student_id:'PRIVATE'}],[id,other],avatars);
 assert.deepEqual(people,[{id,full_name:'Visible name',student_id:null,avatar_url:null,display_avatar_url:avatar},{id:other,full_name:null,student_id:null,avatar_url:null,display_avatar_url:'https://files.example/a.jpg'}]);
 assert.ok(!JSON.stringify(people).includes('LEAK'));
});
test('a failed avatar lookup never blocks the screen or leaks an error',async()=>{
 const{memberAvatarUrls}=await import('../src/lib/scopedProfiles.ts');
 for(const client of[{rpc:async()=>({data:null,error:{message:'AUTHENTICATION_REQUIRED'}}),from:()=>{}},{rpc:async()=>{throw Error('network')},from:()=>{}},{rpc:async()=>({data:'nope',error:null}),from:()=>{}}])
  assert.equal((await memberAvatarUrls(client as never,[id])).size,0);
 assert.equal((await memberAvatarUrls({rpc:async()=>{throw Error('must not be called')},from:()=>{}} as never,[])).size,0);
});
test('large member lists are looked up in batches the database accepts',async()=>{
 const{memberAvatarUrls}=await import('../src/lib/scopedProfiles.ts');const sizes:number[]=[];
 const many=Array.from({length:1201},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 await memberAvatarUrls({rpc:async(_:string,args:Record<string,unknown>)=>{sizes.push((args.p_user_ids as string[]).length);return{data:[],error:null}},from:()=>{}} as never,many);
 assert.deepEqual(sizes,[500,500,201]);
});
