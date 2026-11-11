import 'server-only';
import {aiUserClient} from './aiServer';
import {aiSources} from './aiSources';
import {guides} from '@/components/publications/docs';
import {serviceSearchPages} from './serviceNavigation';
import {parseStudentGradeClass} from './studentId';

export type SiteSource={title:string;url:string;text:string};
export type SiteContext={checked_at:string;sources:SiteSource[]};
const canonical=(href:string)=>href.startsWith('/')?'https://cbgpu.com'+href:href;

export function requestedDate(question:string,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const explicit=question.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
 if(explicit){
  const value=explicit[1]+'-'+explicit[2].padStart(2,'0')+'-'+explicit[3].padStart(2,'0');
  if(!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value)return value;
 }
 const delta=/모레/.test(question)?2:/내일/.test(question)?1:/어제/.test(question)?-1:0;
 return new Date(Date.parse(today+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
}

function score(question:string,text:string){
 const lower=question.toLowerCase();
 const terms=serviceSearchPages.flatMap(service=>(service.title+' '+service.keywords).toLowerCase().split(/\s+/))
  .filter(word=>word.length>=2&&lower.includes(word));
 const words=[...new Set([...(lower.match(/[a-z0-9]{2,}|[가-힣]{2,}/g)||[]),...terms])].slice(0,50);
 const normalized=text.toLowerCase();
 return words.reduce((total,word)=>total+(normalized.includes(word)?word.length:0),0);
}

export async function cbgpuKnowledge(token:string,owner:string,question:string):Promise<SiteContext>{
 const client=aiUserClient(token);
 const date=requestedDate(question);
 const sources:SiteSource[]=[];
 const tasks:Promise<void>[]=[];
 const add=(title:string,href:string,value:unknown)=>{
  const text=typeof value==='string'?value:JSON.stringify(value);
  sources.push({title:title.slice(0,160),url:canonical(href),text:text.length>1600?text.slice(0,1500)+'\n[길이 제한으로 일부만 표시됨]':text});
 };
 async function collect(title:string,href:string,load:()=>Promise<unknown>){
  try{add(title,href,await load())}
  catch{add(title,href,'이번 조회에 실패했습니다. 현재 상태를 확인할 수 없습니다. 관련 화면에서 다시 확인해 주세요.')}
 }
 async function local(path:string){
  const port=Number(process.env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local port');
  const response=await fetch('http://127.0.0.1:'+port+path,{
   headers:{Authorization:'Bearer '+token,Host:'app.cbgpu.com'},
   redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12_000),
  });
  if(!response.ok)throw Error('Source unavailable');
  const value=await response.json();
  if(value.error||value.stale)throw Error('Stale source');
  return value;
 }
 async function rows(table:string,fields:string,own=false){
  let query=client.from(table).select(fields).order('created_at',{ascending:false}).limit(10);
  if(own)query=query.eq('user_id',owner);
  const result=await query;
  if(result.error)throw result.error;
  return {scope:own?'로그인한 본인의 기록':'현재 계정에 공개된 최근 기록',limit:10,rows:result.data||[]};
 }
 const addTask=(title:string,href:string,load:()=>Promise<unknown>)=>tasks.push(collect(title,href,load));
 if(/급식|식단|점심|저녁|아침|중식|석식|조식|밥|meal/i.test(question)){
  addTask(date+' 급식','/meal',async()=>{
   const value=await local('/api/meal?date='+date.replaceAll('-',''));
   return {date,meals:value.meals,source_cache:'학교 식단은 최대 30분 캐시될 수 있습니다. 빈 목록은 식단 미등록일 수 있습니다.'};
  });
 }
 if(/시간표|수업|교시|timetable/i.test(question)){
  addTask('시간표','/timetable',async()=>{
   const explicit=question.match(/([1-3])학년\s*([1-9])반/);
   const {data,error}=await client.from('profiles').select('student_id').eq('id',owner).maybeSingle();
   if(error)throw error;
   const own=explicit?{grade:Number(explicit[1]),cls:Number(explicit[2])}:parseStudentGradeClass(data?.student_id);
   if(!own)return '학년과 반을 확인할 수 없습니다. 몇 학년 몇 반인지 질문에 적어 주세요.';
   const value=await local('/api/timetable?grade='+own.grade+'&class='+own.cls);
   return {grade:own.grade,class:own.cls,target_date:date,weekday_monday_zero:(new Date(date+'T00:00:00Z').getUTCDay()+6)%7,
    weekStart:value.weekStart,fetchedAt:value.fetchedAt,grid:value.grid,times:value.times};
  });
 }
 if(/자습|자리|좌석|내 신청|selfstudy|eduset/i.test(question)){
  addTask('내 자습 신청','/study',async()=>{
   const value=await local('/api/study/student');
   return {date:value.date,open:value.open,entries:value.entries,periods:value.periods,
    note:'이 조회는 오늘의 본인 신청입니다. 다른 날짜의 신청은 이 자료로 확인할 수 없습니다.'};
  });
 }
 if(/gpu|주피터|jupyter|예약/i.test(question)){
  addTask('GPU 접속 상태','/dashboard',async()=>{
   const value=await local('/api/gpu-status');
   return {gpus:value.gpus,checkedAt:value.checkedAt,note:'접속 응답 여부입니다. 예약 가능 여부나 실제 GPU 사용량을 나타내지 않습니다.'};
  });
  addTask('내 GPU 예약','/dashboard',async()=>{
   const {data,error}=await client.from('reservations').select('gpu_id,start_time,end_time,status')
    .eq('user_id',owner).gt('end_time',new Date().toISOString()).order('start_time').limit(10);
   if(error)throw error;
   return {scope:'본인의 종료되지 않은 예약, 최대 10개',rows:data||[]};
  });
 }
 if(/프린|출력|제작|print|내 신청/i.test(question)){
  addTask('내 3D 프린팅 신청','/manufacturing/print',()=>rows('print_jobs','id,status,created_at,plates_completed,plate_count',true));
 }
 if(/레이저|커팅|제작|laser|내 신청/i.test(question)){
  addTask('내 레이저 커팅 신청','/manufacturing/laser',()=>rows('laser_jobs','id,status,created_at',true));
 }
 if(/배포|서버|deploy|server|frontend|프론트/i.test(question)){
  addTask('내 서버 배포','/server',async()=>{
   const value=await local('/api/deploy/servers/projects');
   return {scope:'본인 및 공동작업자로 열람 가능한 프로젝트, 최근 10개',
    projects:(value.projects||[]).slice(0,10).map((project:Record<string,unknown>)=>({
     id:project.id,name:project.name,status:project.status,memory_limit:project.memory_limit,
     runtime:project.runtime,deployed_at:project.deployed_at,deploy_requested_at:project.deploy_requested_at,
    })),note:'DB의 승인·배포 요청 기록입니다. 실제 실행 상태는 프로젝트 상세에서 확인해야 합니다.'};
  });
  addTask('내 프론트엔드 배포','/deploy',async()=>{
   const value=await local('/api/deploy/projects');
   const projects=Array.isArray(value)?value:value.projects||[];
   return projects.slice(0,10).map((project:Record<string,unknown>)=>({
    id:project.id,name:project.name,status:project.status,url:project.url,updated_at:project.updated_at,
   }));
  });
 }
 if(/공지|소식|학사|news/i.test(question)){
  addTask('학교 공지','/feed',async()=>{
   const value=await local('/api/school-news?type=notice');
   return {items:(value.items||[]).slice(0,5).map((item:Record<string,unknown>)=>({title:item.title,published:item.pubDate})),
    note:'학교 공지 제목과 게시일이며 본문은 포함되지 않습니다. 최대 10분 캐시될 수 있습니다.'};
  });
 }
 if(/기상송|노래|wakeup/i.test(question))addTask('내 기상송 신청','/wakeup',()=>rows('wakeup_songs','id,title,status,play_date,created_at',true));
 if(/대회|행사|contest|event/i.test(question))addTask('공개 대회·행사','/contests',()=>rows('contests','id,title,event_start_at,event_end_at,registration_open,lifecycle_status,created_at'));
 if(/투표|설문|poll/i.test(question))addTask('현재 투표','/polls',()=>rows('polls','id,title,ends_at,is_active,created_at'));
 if(/스터디|모임|매칭/i.test(question))addTask('스터디 모집','/match',()=>rows('study_posts','id,title,subject,is_open,created_at'));
 tasks.push((async()=>{
  try{
   const found=await aiSources(token,'all');
   const ranked=found.filter(source=>!source.id.startsWith('doc:'))
    .map(source=>({source,score:score(question,source.text)})).filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score).slice(0,2);
   for(const {source} of ranked)add(source.label,source.href,'현재 열람 가능한 자료의 발췌: '+source.text.slice(0,1400));
  }catch{
   if(/자료|노트|논문|연구|paper|note|파일/i.test(question)){
    add('자료 검색','/materials','현재 자료 검색에 실패했습니다. 자료가 없는 것으로 단정하지 마세요.');
   }
  }
 })());
 await Promise.all(tasks);
 const descriptions=serviceSearchPages.map(service=>({title:service.title,url:canonical(service.href),text:service.description+' '+service.keywords}));
 const sections=guides.flatMap(guide=>guide.sections.map(section=>({
  title:guide.title+' · '+section.title,url:'https://docs.cbgpu.com/'+guide.slug,
  text:[section.body,...(section.steps||[])].join('\n').slice(0,1600),
 })));
 const ranked=[...descriptions,...sections].map(source=>({source,score:score(question,source.title+' '+source.text)}))
  .filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,8-sources.length));
 if(!ranked.length)ranked.push({score:0,source:{title:'CBGPU 서비스 안내',url:'https://cbgpu.com/services',
  text:serviceSearchPages.map(service=>service.title+': '+service.description).join('\n').slice(0,1600)}});
 let budget=6500;
 const selected=[...sources,...ranked.map(item=>item.source)].slice(0,8).map(source=>{
  const maximum=Math.min(1600,budget);
  budget-=Math.min(source.text.length,maximum);
  return {...source,text:source.text.slice(0,maximum)};
 }).filter(source=>source.text.length>0);
 return {checked_at:new Date().toISOString(),sources:selected};
}
