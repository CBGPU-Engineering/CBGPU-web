/** School-scoped display helpers; authorization and transitions belong to the server. */
export function schoolGpuTime(value:string):string {
 const time=Date.parse(value);
 return Number.isFinite(time)?new Date(time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시간 정보 없음';
}
export function schoolGpuPeriod(start:string,end:string,now:number):string {
 const a=Date.parse(start),b=Date.parse(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return '시간 확인 필요';
 return b<=now?'종료':a>now?'시작 전':'예약 시간 진행 중';
}
export function schoolGpuStatus(status:string):string {
 const labels:Record<string,string>={pending:'승인 대기',approved:'승인됨',rejected:'거절됨',RESERVED:'예약됨',CANCELLED:'취소됨',REVOKED:'이용 중지',COMPLETED:'종료됨',EXPIRED:'만료됨',ACTIVE:'사용 중'};
 return labels[status]||'상태 확인 필요';
}
export function schoolGpuScopeMatches(value:unknown,schoolId:string):boolean {
 return !!value&&typeof value==='object'&&'school_id' in value&&value.school_id===schoolId;
}
export const schoolGpuFilters=['all','pending','approved','rejected','reserved','cancelled','revoked','active','upcoming','ended'] as const;
export type SchoolGpuAction='approve'|'reject'|'cancel'|'revoke';
export type SchoolGpuAdminRow={id:string;source:'legacy'|'registry';status:string;start_time:string;end_time:string;purpose:string|null;gpu_id:string;gpu_label:string;owner:{id:string|null;full_name:string|null;student_number:string|null};allowed_actions:SchoolGpuAction[]};
export type SchoolGpuAdminPage={school_id:string;items:SchoolGpuAdminRow[];next_cursor:string|null;server_now:string};
export const schoolGpuActionLabels:Record<SchoolGpuAction,string>={approve:'승인',reject:'거절',cancel:'예약 취소',revoke:'이용 중지'};
export function canSchoolGpuAction(row:SchoolGpuAdminRow,action:SchoolGpuAction,now:number):boolean {
 if(!row.allowed_actions.includes(action)||!Number.isFinite(Date.parse(row.end_time))||Date.parse(row.end_time)<=now)return false;
 if(action==='approve'||action==='reject')return row.source==='legacy'&&row.status==='pending';
 return row.source==='registry'?row.status==='RESERVED':row.status==='approved';
}
export function validateSchoolGpuPage(value:SchoolGpuAdminPage,schoolId:string):SchoolGpuAdminPage {
 if(!schoolGpuScopeMatches(value,schoolId)||!Array.isArray(value.items)||value.items.length>50||!Number.isFinite(Date.parse(value.server_now))||(value.next_cursor!==null&&(typeof value.next_cursor!=='string'||value.next_cursor.length>4096)))throw Error('학교 예약 응답을 확인하지 못했어요. 새로고침해 주세요.');
 const actions=['approve','reject','cancel','revoke'];
 for(const row of value.items){
  if(!row||!['legacy','registry'].includes(row.source)||row.source==='legacy'&&schoolId!=='cbsh'||typeof row.id!=='string'||!row.id||typeof row.gpu_id!=='string'||typeof row.gpu_label!=='string'||typeof row.status!=='string'||!(row.purpose===null||typeof row.purpose==='string')||!(row.owner?.full_name===null||typeof row.owner?.full_name==='string')||!(row.owner?.student_number===null||typeof row.owner?.student_number==='string')||typeof row.start_time!=='string'||typeof row.end_time!=='string'||!row.owner||!(typeof row.owner.id==='string'||row.source==='legacy'&&row.owner.id===null)||!Array.isArray(row.allowed_actions)||row.allowed_actions.some(action=>!actions.includes(action)))throw Error('현재 학교와 다른 예약 응답을 표시하지 않았어요. 다시 조회해 주세요.');
 }
 return value;
}
export type SchoolGpuSession={user:{id:string};access_token:string}|null;
/** Single bounded request; owner and mount fences run after every credential await. Never retries writes. */
export async function schoolGpuAdminRequest<T>(path:string,method:string,body:unknown,owner:string,getSession:()=>Promise<SchoolGpuSession>,current:()=>boolean,fetcher:typeof fetch=fetch):Promise<T>{
 if(!/^schools\/[-A-Za-z0-9_]{1,100}\/gpu\/admin\/reservations(?:\?[^#]*|\/[A-Za-z0-9-]+\/action)?$/.test(path)||!['GET','POST'].includes(method))throw Error('예약 요청 경로를 확인해 주세요.');
 let session:SchoolGpuSession;try{session=await getSession()}catch{throw Error('로그인 상태를 확인하지 못했어요. 잠시 후 다시 조회해 주세요.')}if(!current()||session?.user.id!==owner||!session.access_token)throw Error('계정이 바뀌었어요. 현재 학교를 다시 열어 주세요.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetcher('/api/compute/'+path,{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Accept:'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:controller.signal});
  if(response.redirected||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('예약 응답을 확인하지 못했어요. 새로고침해 주세요.');
  if(!response.body)throw Error('예약 응답이 없어요. 새로고침해 주세요.');
  const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder();
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024)throw Error('예약 응답이 너무 커요. 검색 조건을 좁혀 주세요.');text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}finally{void reader.cancel().catch(()=>{})}
  const value=JSON.parse(text);const fresh=await getSession();if(!current()||fresh?.user.id!==owner)throw Error('계정이 바뀌었어요. 현재 학교를 다시 열어 주세요.');
  if(!response.ok){if(response.status===401||response.status===403)throw Error('이 학교의 GPU 예약 관리 권한을 확인해 주세요.');if(response.status===409)throw Error('예약 상태나 GPU 이용 상황이 바뀌었어요. 실행 중인 이용자를 중단하지 않도록 새로고침 후 다시 확인해 주세요.');if(response.status===404||response.status===503)throw Error('현재 서버에서 예약 관리를 사용할 수 없어요. 잠시 후 다시 조회해 주세요.');throw Error('예약 요청을 처리하지 못했어요. 새로고침 후 상태를 확인해 주세요.')}
  return value as T;
 }catch(e){if(controller.signal.aborted)throw Error('예약 요청 시간이 초과됐어요. 다시 처리하기 전에 새로고침으로 상태를 확인해 주세요.');if(e instanceof Error&&/[가-힣]/.test(e.message))throw e;throw Error('예약 요청 결과를 확인하지 못했어요. 다시 처리하기 전에 새로고침해 주세요.')}finally{clearTimeout(timer)}
}
