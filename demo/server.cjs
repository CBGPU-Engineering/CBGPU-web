const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixtures=require('./fixtures.cjs');
// Transpile only the existing pure contract modules, never production API clients.
const ts=require('../node_modules/typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {validateAutomation,nextAutomaticStudyDate}=require('../src/lib/studyAutomation.ts');
const {handleStudentStudy,StudyFailure}=require('../src/lib/edusetStudent.ts');
function createDemoServer(){
 const data=fixtures.tables(),sessions=new Map(),connections=new Map(),automation=new Map(),aiJobs=new Map(),aiKeys=new Map(),aiUploads=new Map(),aiChats=new Map(),robotPlans=new Map(),remoteDevices=new Map();let records=[],sequence=1;
 function userFor(req){return sessions.get((req.headers['x-cbgpu-auth']||req.headers.authorization||'').replace(/^Bearer /,''))||null}
 const student={id:'demo-school-student',name:'Demo Student',grade:2,classNo:3,number:1};
 const rooms=[{id:1,name:'Demo study room',hasSeats:true,width:2,height:1}],teachers=[{id:'demo-teacher',name:'Demo Teacher'}];
 const composition={seats:[{id:1,x:0,y:0,name:'1'},{id:2,x:1,y:0,name:'2'}],obstacles:[]};
 const policy={timelimit:{assign:Array(7).fill({start:{h:0,m:0},end:{h:24,m:0}}),exception:{}},timetable:{assign:Array(7).fill('demo'),presets:{demo:[{},{}]},exception:{}}};
 const school=async(p,token,method='GET',body)=>{
  if(token!==fixtures.schoolToken)throw new StudyFailure('Use the synthetic demo school account.',401);
  if(p==='/users/'+student.id)return {id:student.id,role:'STUDENT'};
  if(p==='/students/'+student.id)return student;
  if(p==='/policies/selfstudy')return {data:policy};
  if(p==='/rooms')return rooms;if(p==='/teachers')return teachers;
  if(p==='/rooms/1/composition')return composition;
  if(p==='/selfstudy/search')return records;
  if(p==='/selfstudy'&&method==='POST'){const row={id:sequence++,type:'selfstudy',student,date:body.date,period:body.period,status:'PENDING',room:rooms[0],seat:{id:body.seatId,name:String(body.seatId)},teacher:teachers[0],reason:body.reason};records.push(row);return row}
  if(method==='DELETE'&&p.startsWith('/selfstudy/')){records=records.filter(r=>String(r.id)!==p.split('/').pop());return null}
  throw new StudyFailure('This school operation is not implemented in the demo.',501);
 };
 const server=http.createServer(async(req,res)=>{
  const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-CBGPU-Demo':'synthetic'});res.end(JSON.stringify(value))};
  try{
   const p=new URL(req.url,'http://localhost').pathname.replace(/^\/backend/,'');let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>65536)return reply(413,{message:'Demo request too large'})}
   let body={};try{body=p==='/api/ai/uploads'?{}:raw?JSON.parse(raw):{}}catch{return reply(400,{message:'Invalid JSON'})}
   if(p==='/health')return reply(200,{demo:true,persistent:false,outbound:false});
   if(p==='/auth/v1/token'&&req.method==='POST'){
    const u=fixtures.users.find(u=>body.email===u.email&&body.password===fixtures.password||body.refresh_token==='demo-refresh-'+u.id);
    if(!u)return reply(400,{error:'invalid_grant',error_description:'Use student@example.invalid or researcher@example.invalid with password demo-only.'});
    const s=fixtures.session(u);sessions.set(s.access_token,u);return reply(200,s);
   }
   const user=userFor(req);
   if(p==='/auth/v1/user')return user?reply(200,fixtures.session(user).user):reply(401,{message:'Demo login required'});
   if(p==='/auth/v1/logout'){sessions.delete((req.headers.authorization||'').replace(/^Bearer /,''));return reply(200,{})}
   if(p.startsWith('/auth/'))return reply(501,{message:'OAuth, email and account creation are disabled in the local demo.'});
   if(p==='/api/study/automation'){
    if(!user)return reply(401,{message:'Demo login required'});
    if(req.method==='POST'){
     if(body.action==='disable'){const old=automation.get(user.id);if(old)automation.set(user.id,{...old,enabled:false})}
     else{try{const settings=validateAutomation(body);automation.set(user.id,{...settings,starts_on:nextAutomaticStudyDate(settings.run_time,new Date('2026-11-03T07:00:00Z'))})}catch(e){return reply(400,{message:e.message})}}
    }
    return reply(200,{settings:automation.get(user.id)||null,runs:[]});
   }
   if(p==='/api/ai'||p.startsWith('/api/ai/')){
    if(!user)return reply(401,{message:'Demo login required'});
    const route=p.slice('/api/ai'.length),now=Date.now()/1000;
    const make=(kind,input,title)=>{const id=require('node:crypto').randomUUID();const job={id,owner:user.id,kind,title:title||kind,state:'succeeded',created:now,updated:now,gpu:null,attempts:1,progress:'Synthetic demo output; no GPU used',artifacts:[],result:kind==='transcribe'?{text:'Synthetic demo transcript.',srt:'1\n00:00:00,000 --> 00:00:01,000\nSynthetic demo transcript.'}:kind==='search'?{hits:[{id:'doc:ai',label:'CBGPU AI guide',href:'https://docs.cbgpu.com/ai',snippet:'Synthetic search fixture.',score:1}]}:kind==='python'?{text:'Synthetic GPU job completed; no code was executed.'}:{choices:[{message:{content:input?.messages?.[0]?.content?.includes('프롬프트')?'Synthetic optimized prompt.':'Synthetic local AI response.'}}]}};aiJobs.set(id,job);return job};
    if(route==='/v1/robotics/devices'&&req.method==='GET')return reply(200,{devices:[...remoteDevices.values()].filter(d=>d.owner===user.id).map(d=>({id:d.id,name:d.name,online:true,paired:true,last_seen:now}))});
    if(route==='/v1/robotics/devices'&&req.method==='POST'){const id=require('node:crypto').randomUUID(),rle=[],cells=[];for(let y=0;y<16;y++)for(let x=0;x<16;x++)cells.push(x===0||y===0||x===15||y===15?100:x>11&&y>11?-1:0);for(const v of cells){if(rle.length&&rle.at(-2)===v)rle[rle.length-1]++;else rle.push(v,1)}const d={id,owner:user.id,name:body.name,online:true,paired:true,last_seen:now,created:now,control_until:0,lease:null,stop_epoch:0,telemetry:{armed:true,ready:true,emergency_stop:false,navigation_enabled:true,pose:{x:2,y:2,yaw:0},mode:'simulation'},map:{width:16,height:16,resolution:.5,origin:{x:0,y:0,yaw:0},frame:'map',session:'demo-map',version:1,rle}};remoteDevices.set(id,d);const {owner,lease,...device}=d;return reply(201,{device,pair_code:'synthetic-pair-code-not-a-real-secret',expires_at:now+600})}
    if(route.startsWith('/v1/robotics/devices/')){const parts=route.split('/'),d=remoteDevices.get(parts[4]);if(!d||d.owner!==user.id)return reply(404,{message:'Device not found'});const action=parts[5];if(req.method==='DELETE'){remoteDevices.delete(d.id);return reply(200,{ok:true})}if(req.method==='POST'&&action==='control'){if(body.release){d.control_until=0;d.lease=null;return reply(200,{released:true})}d.lease=body.lease;d.control_until=now+10;return reply(200,{lease:body.lease,expires_at:d.control_until})}if(req.method==='POST'&&action==='goal'){if(d.lease!==body.lease)return reply(409,{message:'Control required'});d.command={id:require('node:crypto').randomUUID(),kind:'navigate',state:'queued',created:now,payload:body,updated:now};d.ticks=0;return reply(202,{command:d.command})}if(req.method==='POST'&&action==='stop'){d.control_until=0;d.lease=null;d.stop_epoch++;if(d.command)d.command.state='cancelled';return reply(200,{ok:true})}if(req.method==='POST'&&action==='pair')return reply(200,{pair_code:'synthetic-pair-code-not-a-real-secret'});if(d.command&&['queued','dispatched','running'].includes(d.command.state)){d.ticks++;d.command.state=d.ticks<2?'running':'succeeded';d.command.accepted_at=d.command.created+.1;if(d.ticks>=2)d.telemetry.pose={x:d.command.payload.x,y:d.command.payload.y,yaw:0}}d.map.version++;d.last_seen=now;const {owner,lease,ticks,...device}=d;return reply(200,device)}
    if(route==='/v1/robotics/plans'&&req.method==='POST'){const id=require('node:crypto').randomUUID();robotPlans.set(id,{id,owner:user.id,state:'succeeded',mission:{id,robot_id:body.robot_id,expires_at:now+120,plan:{summary:'Synthetic robot plan: go to charging station. No hardware used.',needs_clarification:false,question:'',steps:[{capability:'navigate_to',arguments:{waypoint:'charging_station'},duration_s:10}]}}});return reply(202,{id,state:'queued',protocol_version:1})}
    if(route.startsWith('/v1/robotics/plans/')){const plan=robotPlans.get(route.split('/').pop());if(!plan||plan.owner!==user.id)return reply(404,{message:'Plan not found'});if(req.method==='DELETE')plan.state='cancelled';const {owner,...result}=plan;return reply(200,result)}
    if(route==='/chats'&&req.method==='GET')return reply(200,{chats:[...aiChats.values()].filter(c=>c.owner===user.id).sort((a,b)=>b.updated-a.updated).map(({messages,owner,...c})=>c)});
    if(route==='/chats'&&req.method==='POST'){const chat={id:require('node:crypto').randomUUID(),owner:user.id,title:'새 대화',updated:now,messages:[]};aiChats.set(chat.id,chat);return reply(201,{chat})}
    if(route.startsWith('/chats/')){const id=route.split('/')[2],chat=aiChats.get(id);if(!chat||chat.owner!==user.id)return reply(404,{message:'Chat not found'});if(req.method==='DELETE'){aiChats.delete(id);return reply(200,{ok:true})}if(req.method==='POST'){if(route.endsWith('/messages')){if(!chat.messages.length)chat.title=body.content.slice(0,70);chat.model=body.model||'cbgpu-chat';chat.effort=body.effort||'medium';chat.messages.push({id:require('node:crypto').randomUUID(),role:'user',content:body.content,state:'succeeded'},{id:require('node:crypto').randomUUID(),role:'assistant',sources:(body.attachments||[]).map(id=>({title:aiUploads.get(id)?.name||'fixture.png',page:1,ocr:true,excerpt:'Synthetic OCR fixture text: Voltage 12.5 V'})),content:'Synthetic conversation answer.\n\n```python\nprint("CBGPU")\n```',state:'succeeded'});chat.updated=now}else chat.title=body.title}return reply(200,{chat})}
    if(route==='/status')return reply(200,{scheduler:{status:'ok',gpus:[{id:1,available:true,reserved:false}]},queue:{queued:0,running:0}});
    if(route==='/jobs'&&req.method==='GET')return reply(200,{jobs:[...aiJobs.values()].filter(j=>j.owner===user.id)});
    if(route==='/jobs'&&req.method==='POST')return reply(202,{job:make(body.kind,body.input,body.title)});
    if(route==='/search'&&req.method==='POST')return reply(202,{job:make('search',{},'Synthetic search')});
    if(route==='/uploads'&&req.method==='POST'){const id=require('node:crypto').randomUUID();aiUploads.set(id,{owner:user.id,name:new URL(req.url,'http://localhost').searchParams.get('name')||'demo.wav'});return reply(201,{id,name:aiUploads.get(id).name,size:raw.length})}
    if(route.startsWith('/uploads/')){const [,,id,action]=route.split('/'),upload=aiUploads.get(id);if(!upload||upload.owner!==user.id)return reply(404,{message:'Upload not found'});if(action==='text')return reply(200,{text:'[1쪽]\nSynthetic OCR fixture text: Voltage 12.5 V'});return reply(200,{file:{id,name:upload.name,state:'ready',pages:1,progress:1,ocr_pages:1,weak_pages:[],empty_pages:[]}})}
    if(route==='/keys'&&req.method==='GET')return reply(200,{keys:[...aiKeys.values()].filter(k=>k.owner===user.id)});
    if(route==='/keys'&&req.method==='POST'){const id=require('node:crypto').randomUUID(),key='cbgpu_ai_demo_'+id;aiKeys.set(id,{id,owner:user.id,name:body.name,prefix:'cbgpu_ai_demo',created:now,last_used:null});return reply(201,{id,key})}
    if(route.startsWith('/keys/')&&req.method==='DELETE'){const id=route.split('/')[2];if(aiKeys.get(id)?.owner===user.id)aiKeys.delete(id);return reply(200,{ok:true})}
    if(route.startsWith('/jobs/')){const id=route.split('/')[2],job=aiJobs.get(id);if(!job||job.owner!==user.id)return reply(404,{message:'Task not found'});if(req.method==='DELETE'){aiJobs.delete(id);return reply(200,{ok:true})}return reply(200,{job})}
    if(route===''&&req.method==='POST'){const job=make('chat',{},body.mode);return reply(202,{job_id:job.id,state:job.state,provider:'synthetic-demo'})}
    return reply(404,{message:'Unsupported synthetic AI operation'});
   }
   if(p==='/api/study/student'){
    const headers={...req.headers,host:'student.cbgpu.com',origin:'https://student.cbgpu.com'};
    const request=new Request('https://student.cbgpu.com/api/study/student',{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:raw});
    const result=await handleStudentStudy(request,{authorize:async()=>user?.id||null,limit:()=>true,now:()=>new Date('2026-11-03T07:00:00Z'),send:school,getConnection:async id=>connections.get(id)||null,remember:async(id,t)=>{connections.set(id,t)},disconnect:async id=>{connections.delete(id)}});
    return reply(result.status,await result.json());
   }
   if(p.startsWith('/api/study/proxy/')){
    if(!user)return reply(401,{message:'Demo login required'});
    const endpoint=p.slice('/api/study/proxy'.length);
    if(endpoint.endsWith('/composition'))return reply(200,composition);
    if(endpoint==='/selfstudy/search')return reply(201,[...records,{id:'demo-outstay',type:'outstay',student,from:'2026-11-03T00:00:00Z',to:'2026-11-03T03:00:00Z'}]);
    if(endpoint.startsWith('/policies/'))return reply(200,{data:policy});
    if(endpoint==='/rooms')return reply(200,rooms);if(endpoint==='/teachers')return reply(200,teachers);
    return reply(200,[]);
   }
   if(p==='/rest/v1/rpc/get_gpu_reservation_schedule')return reply(200,[]);
   if(p.startsWith('/rest/v1/')){
    if(!user)return reply(401,{message:'Demo login required'});
    const table=p.slice('/rest/v1/'.length);let rows=data[table]||[];
    const url=new URL(req.url,'http://localhost');
    for(const [key,value]of url.searchParams){if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3))}
    if(req.method!=='GET'&&req.method!=='HEAD')return reply(501,{message:'Table editing is outside the demo. School applications use the isolated fixture API.'});
    const single=(req.headers.accept||'').includes('vnd.pgrst.object');
    return reply(200,single?(rows[0]||null):rows);
   }
   if(p==='/api/traffic')return reply(200,{ok:true,demo:true});
   if(p==='/api/gpu-status'||p==='/functions/v1/gpu-status')return reply(200,[1,2,3,4].map(id=>({gpu_id:id,status:'idle',utilization:0,memory_used:0,demo:true})));
   if(p==='/api/deploy/projects'&&req.method==='GET')return user?reply(200,{projects:[]}):reply(401,{message:'Demo login required'});
   return reply(501,{message:'This integration is not simulated. The demo never forwards requests to a real service.',demo:true});
  }catch{return reply(500,{message:'Demo fixture error'})}
 });
 const {WebSocketServer}=require('../node_modules/ws');
 const realtime=new WebSocketServer({noServer:true});
 server.on('upgrade',(req,socket,head)=>{if(!req.url.startsWith('/backend/realtime/'))return socket.destroy();realtime.handleUpgrade(req,socket,head,ws=>{ws.on('message',raw=>{try{const value=JSON.parse(raw.toString());if(Array.isArray(value)){const [join,ref,topic,event]=value;ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:event==='phx_join'?{postgres_changes:[]}:{}}]))}else if(value.event){ws.send(JSON.stringify({topic:value.topic,event:'phx_reply',ref:value.ref,payload:{status:'ok',response:{postgres_changes:[]}}}))}}catch{ws.close(1003)}})})});
 server.on('close',()=>realtime.close());return server;
}
if(require.main===module){if(process.env.CBGPU_DEMO!=='1')throw Error('Start with node scripts/demo.mjs; this server is for local fixtures only.');const port=Number(process.env.CBGPU_DEMO_API_PORT||54329);createDemoServer().listen(port,'127.0.0.1',()=>console.log('Synthetic demo API on loopback:'+port))}
module.exports={createDemoServer};
