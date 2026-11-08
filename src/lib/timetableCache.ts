/** Bounded last-good storage and request coalescing; stale data is never silent. */
export type TimetableRaw=Record<string,any>;
export type TimetableSnapshot={version:1;at:number;raw:TimetableRaw};
export type TimetableStore={read:()=>Promise<unknown>;write:(value:TimetableSnapshot)=>Promise<void>};
const FRESH=5*60_000,MAX_AGE=48*60*60_000,RETRY=60_000;
function monday(date:string){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
export function validTimetableRaw(raw:unknown):raw is TimetableRaw{
 if(!raw||typeof raw!=='object')return false;const x=raw as TimetableRaw;
 if(!['자료481','자료147','자료446','자료492','학급수'].every(k=>Array.isArray(x[k])))return false;
 const separator=Number(x['분리']??100);if(!Number.isSafeInteger(separator)||separator<=0)return false;
 const hasSubject=(cell:unknown)=>{
  const value=Number(String(cell).replace(/^>/,''));
  const subject=x['자료492'][Math.floor(value/1000)%1000%separator];
  return Number.isSafeInteger(value)&&value%1000>0&&typeof subject==='string'&&subject.trim().length>0;
 };
 return x['자료147'].some((grade:unknown)=>Array.isArray(grade)&&grade.some(room=>Array.isArray(room)&&room.some(day=>Array.isArray(day)&&day.some(hasSubject))));
}
export function usableTimetableSnapshot(value:unknown,now:number):value is TimetableSnapshot{
 const x=value as TimetableSnapshot;if(!x||x.version!==1||!Number.isFinite(x.at)||x.at>now+60_000||now-x.at>MAX_AGE||!validTimetableRaw(x.raw))return false;
 const date=new Date(now+9*3600_000).toISOString().slice(0,10),current=monday(date),week=x.raw['시작일'];
 if(typeof week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week))return false;
 const diff=(Date.parse(week)-Date.parse(current))/86400_000,day=new Date(date+'T00:00:00Z').getUTCDay();
 return diff===0||((day===0||day===6)&&diff===7);
}
export function createTimetableLoader(load:()=>Promise<TimetableRaw>,store:TimetableStore,clock=Date.now){
 let snapshot:TimetableSnapshot|null=null,boot:Promise<void>|null=null,pending:Promise<{raw:TimetableRaw;at:number;stale:boolean}>|null=null,retryAt=0,lastError:unknown=null,started=0;
 const current=()=>snapshot&&usableTimetableSnapshot(snapshot,clock())?snapshot:null;
 const answer=(work:Promise<{raw:TimetableRaw;at:number;stale:boolean}>)=>{
  const saved=current();if(!saved)return work;
  let timer:ReturnType<typeof setTimeout>;
  const budget=Math.max(0,3000-(Date.now()-started));
  return Promise.race([work,new Promise<{raw:TimetableRaw;at:number;stale:boolean}>(resolve=>{timer=setTimeout(()=>resolve({...saved,stale:true}),budget)})]).finally(()=>clearTimeout(timer));
 };
 return {async get(force=false):Promise<{raw:TimetableRaw;at:number;stale:boolean}>{
  boot??=store.read().then(value=>{if(usableTimetableSnapshot(value,clock()))snapshot=value}).catch(()=>{});await boot;
  if(pending)return answer(pending);
  const cached=current();
  if(clock()<retryAt){if(cached)return {...cached,stale:true};throw lastError||Error('시간표 제공처에 잠시 연결할 수 없습니다')}
  if(!force&&!lastError&&cached&&clock()-cached.at<FRESH)return {...cached,stale:false};
  started=Date.now();
  pending=(async()=>{
   try{
    const raw=await load();if(!validTimetableRaw(raw))throw Error('시간표 제공처의 데이터가 비어 있습니다');
    snapshot={version:1,at:clock(),raw};retryAt=0;lastError=null;
    await store.write(snapshot).catch(()=>console.warn('Timetable last-good persistence unavailable'));
    return {raw,at:snapshot.at,stale:false};
   }catch(error){lastError=error;retryAt=clock()+RETRY;console.warn('Timetable refresh unavailable; last-good fallback checked');const saved=current();if(saved)return {...saved,stale:true};throw error}
   finally{pending=null}
  })();return answer(pending);
 }};
}
