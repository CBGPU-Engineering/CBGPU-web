'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Check,Plus,RefreshCw,Unplug,X} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {getRoomComposition,getSeatOccupations,searchSelfStudy,type Seat} from '@/lib/eduset';
import type {StudyContext,OwnStudy,StudyId} from '@/lib/edusetStudent';
import {Button} from '@/components/ui/button';
import SchoolAccountLink from './SchoolAccountLink';
import StudyAutoSettings from './StudyAutoSettings';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
export type StudyPrefill={roomId:StudyId;seatId:StudyId;period:number};
const field='mt-2 w-full min-w-0 min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-base';
const statusLabel:Record<string,string>={PENDING:'승인 대기',APPROVED:'승인됨',REJECTED:'거절됨'};
export default function StudyRequestPanel({prefill,onPrefillConsumed,onChanged}:{prefill:StudyPrefill|null;onPrefillConsumed:()=>void;onChanged:()=>void}){
 const {user,isLoading}=useAuth();const [context,setContext]=useState<StudyContext|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dialog,setDialog]=useState<'connect'|'apply'|null>(null);
 const [roomId,setRoomId]=useState(''),[periods,setPeriods]=useState<number[]>([]),[seatId,setSeatId]=useState(''),[teacherId,setTeacherId]=useState(''),[reason,setReason]=useState('자율학습');
 const [seats,setSeats]=useState<Seat[]>([]),[occupations,setOccupations]=useState<{seatId:StudyId;period:number;studentId:StudyId}[]>([]),[seatLoading,setSeatLoading]=useState(false),[seatError,setSeatError]=useState('');
 const owner=useRef(user?.id);owner.current=user?.id;const refreshId=useRef(0),selectionTouched=useRef(false);
 const request=useCallback(async(body?:unknown)=>{
  const expected=owner.current,{data:{session}}=await supabase.auth.getSession();if(!session||session.user.id!==expected)throw Error('CBGPU 로그인이 필요합니다.');
  const response=await fetch('/api/study/student',{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const data=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(Error(data?.message||'공식 신청 결과를 확인하지 못했습니다. 내 신청을 새로고침해 주세요.'),{code:data?.code,status:response.status});return data;
 },[]);
 const refresh=useCallback(async()=>{const id=++refreshId.current,expected=owner.current;setLoading(true);try{const data=await request();if(id===refreshId.current&&expected===owner.current){setContext(data);setError('')}return expected===owner.current?data as StudyContext:null}catch(e){if(id===refreshId.current&&expected===owner.current){if((e as {code?:string}).code==='school_connection_required'){setContext(null);setError('')}else setError((e as Error).message)}return null}finally{if(id===refreshId.current&&expected===owner.current)setLoading(false)}},[request]);
 useEffect(()=>{++refreshId.current;setContext(null);setError('');setDialog(null);setRoomId('');setSeatId('');setTeacherId('');setReason('자율학습');setPeriods([]);setNotice('');selectionTouched.current=false;if(!user)return;
  try{const saved=JSON.parse(localStorage.getItem('cbgpu-study-choice:'+user.id)||'{}');for(const [key,set] of [['roomId',setRoomId],['seatId',setSeatId],['teacherId',setTeacherId],['reason',setReason]] as const){if(typeof saved[key]==='string'&&saved[key].length<=1000)set(saved[key])}}catch{}
  let cancelled=false;const id=user.id;
  void(async()=>{try{const legacy=sessionStorage.getItem('cbgpu-eduset-student:'+id);if(legacy){await request({action:'remember',accessToken:legacy});sessionStorage.removeItem('cbgpu-eduset-student:'+id)}}catch{}if(!cancelled)await refresh()})();
  return()=>{cancelled=true};
 },[user?.id,refresh,request]);
 useEffect(()=>{if(!context)return;const timer=setInterval(()=>void refresh(),60000);return()=>clearInterval(timer)},[!!context,refresh]);
 useEffect(()=>{if(!context)return;const available=[...context.periods].sort((a,b)=>a-b).filter(p=>!context.entries.some(e=>e.period===p));setPeriods(previous=>selectionTouched.current?previous.filter(p=>available.includes(p)):available)},[context]);
 useEffect(()=>{if(!prefill)return;setRoomId(String(prefill.roomId));setSeatId(String(prefill.seatId));setPeriods([prefill.period]);selectionTouched.current=true;setDialog(context?'apply':'connect');onPrefillConsumed()},[prefill,!!context,onPrefillConsumed]);
 const room=context?.rooms.find(r=>String(r.id)===roomId),occupied=new Set(occupations.filter(r=>periods.includes(Number(r.period))&&String(r.studentId)!==String(context?.student.id)).map(r=>String(r.seatId)));
 useEffect(()=>{let cancelled=false;setSeats([]);setOccupations([]);setSeatError('');if(!room?.hasSeats){setSeatLoading(false);return}setSeatLoading(true);
  void Promise.all([getRoomComposition(room.id),getSeatOccupations(room.id,context!.date),searchSelfStudy({date:context!.date},{fresh:true})]).then(([composition,reservations,requests])=>{if(cancelled)return;setSeats([...composition.seats].sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true})));setOccupations([...reservations,...requests.filter(r=>String(r.room?.id)===String(room.id)&&r.status!=='REJECTED'&&r.seat).map(r=>({seatId:r.seat!.id,studentId:r.student.id,period:r.period}))])}).catch(()=>{if(!cancelled)setSeatError('좌석 현황을 확인하지 못했습니다. 다시 불러와 주세요.')}).finally(()=>{if(!cancelled)setSeatLoading(false)});return()=>{cancelled=true};
 },[room?.id,room?.hasSeats,context?.date,context?.entries]);
 async function disconnect(){if(busy)return;setBusy(true);setError('');try{await request({action:'disconnect'});if(user)sessionStorage.removeItem('cbgpu-eduset-student:'+user.id);++refreshId.current;setContext(null);setNotice('EduSet 연결을 해제했어요. 자동신청도 꺼져요.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function connected(schoolToken:string){if(!user||owner.current!==user.id)throw Error('CBGPU에 다시 로그인해 주세요.');await request({action:'remember',accessToken:schoolToken});const data=await refresh();if(data){setNotice('학교 계정을 연결했어요. 다음부터 바로 신청할 수 있어요.');setDialog('apply')}}
 function openApply(){setError('');if(context&&!selectionTouched.current)setPeriods([...context.periods].sort((a,b)=>a-b).filter(p=>!context.entries.some(e=>e.period===p)));setDialog(context?'apply':'connect')}
 async function apply(e:React.FormEvent){e.preventDefault();if(!context||busy||!periods.length)return;const expected=owner.current;setBusy(true);setError('');setNotice('');let completed=0,failure='';
  try{
   for(const period of [...periods].sort((a,b)=>a-b)){
    try{await request({action:'apply',date:context.date,roomId,teacherId,period,...(room?.hasSeats?{seatId}:{}),reason});completed++}
    catch(e){failure=(e as Error).message;break}
    if(expected!==owner.current)return;
   }
   if(expected!==owner.current)return;
   if(completed){try{localStorage.setItem('cbgpu-study-choice:'+expected,JSON.stringify({roomId,seatId,teacherId,reason}))}catch{}setNotice(`${completed}개 교시를 신청했어요. 다음 신청에는 교실·자리·선생님을 기억해둘게요.`)}
   await refresh();onChanged();
   if(failure)setError(`${completed?completed+'개 교시는 반영됐어요. ':''}${failure}`);else setDialog(null);
  }finally{setBusy(false)}
 }
 async function cancel(entry:OwnStudy){if(!context||busy||!confirm(`${entry.period}교시 ${entry.room.name} 신청을 취소할까요?`))return;setBusy(true);setError('');try{await request({action:'cancel',date:context.date,id:entry.id});setNotice(entry.period+'교시 신청을 취소했어요.');await refresh();onChanged()}catch(e){await refresh();setError((e as Error).message)}finally{setBusy(false)}}
 const windowTime=(value:string)=>value?new Date(value).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}):'확인 필요';
 if(isLoading)return null;
 const maxX=Math.max(1,...seats.map(s=>s.x+1));const gridMode=maxX<=12&&seats.every(s=>Number.isInteger(s.x)&&Number.isInteger(s.y)&&s.x>=0&&s.y>=0);
 return <section aria-label="내 자습 신청" className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
 <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">내 자습 신청</h2><p className="mt-1 text-sm text-muted-foreground">여러 교시를 한 번에 선택하고, 마지막 조건은 다음에도 그대로.</p></div><div className="flex flex-wrap gap-2"><StudyAutoSettings context={context}/>{user?<Button className="min-h-11" disabled={loading||busy||!!context&&!context.open} onClick={openApply}><Plus className="size-4"/>{context?'자습 신청하기':'EduSet 로그인'}</Button>:<Button asChild><Link href="/auth/login?next=%2Fstudy">로그인하고 신청하기</Link></Button>}</div></div>
 {notice&&<p role="status" className="text-sm text-primary">{notice}</p>}{error&&dialog===null&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {loading&&!context&&<p className="text-sm text-muted-foreground">학교 계정 확인 중…</p>}
 {context&&<><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{context.student.grade}{context.student.classNo}{String(context.student.number).padStart(2,'0')} {context.student.name} · {context.date}</span><div className="flex gap-2"><Button size="sm" variant="ghost" aria-label="내 신청 새로고침" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw className="size-4"/></Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void disconnect()}><Unplug className="size-4"/>연결 해제</Button></div></div>
 <p className="text-xs text-muted-foreground">{context.open?'현재 신청 가능':'현재 접수 시간 아님'} · {windowTime(context.opensAt)}–{windowTime(context.closesAt)} (학교 공식 접수)</p>
 <div className="grid gap-2 sm:grid-cols-3">{[...context.periods].sort((a,b)=>a-b).map(period=>{const entry=context.entries.find(e=>e.period===period);return <div key={period} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3"><div className="min-w-0"><p className="text-sm font-semibold">{period}교시</p><p className="mt-1 break-words text-xs text-muted-foreground">{entry?entry.room.name+(entry.seat?' · '+entry.seat.name+'번':''):'아직 신청하지 않았어요.'}</p>{entry&&<p className="mt-1 text-xs text-muted-foreground">{statusLabel[entry.status]||entry.status}</p>}</div>{entry?<Button variant="ghost" size="sm" disabled={!context.open||busy||loading} onClick={()=>void cancel(entry)}>취소</Button>:<Button variant="outline" size="sm" disabled={!context.open||busy} onClick={()=>{setPeriods([period]);selectionTouched.current=true;setDialog('apply')}}>신청</Button>}</div>})}</div>
 </>}
 <Dialog open={dialog!==null} onOpenChange={open=>{if(!open&&!busy){setDialog(null);setError('')}}}><DialogContent data-study-request-dialog showCloseButton={false} className="flex max-h-[90dvh] min-h-0 min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"><DialogHeader className="shrink-0 flex-row items-start gap-3 border-b p-4"><div className="min-w-0 flex-1"><DialogTitle>{dialog==='connect'?'EduSet 학생 계정 연결':'자습 신청'}</DialogTitle><DialogDescription id="study-request-description" className="mt-2">{dialog==='connect'?'학교 계정은 한 번만 연결하면 돼요.':'신청할 교시와 자리를 고르면 끝. 같은 자리로 여러 교시를 한 번에 신청할 수 있어요.'}</DialogDescription></div><DialogClose asChild><Button variant="ghost" size="icon" disabled={busy} aria-label="신청 창 닫기" className="size-11 shrink-0"><X/></Button></DialogClose></DialogHeader><div className="min-h-0 overflow-y-auto overscroll-contain p-4">
 {error&&<p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
 {dialog==='connect'?<SchoolAccountLink onConnected={connected}/>:context&&<form onSubmit={apply} className="space-y-5">
 <fieldset><legend className="text-sm font-semibold">1. 신청할 교시</legend><div className="mt-2 flex flex-wrap gap-2">{[...context.periods].sort((a,b)=>a-b).map(p=>{const exists=context.entries.some(e=>e.period===p);return <button type="button" key={p} aria-pressed={periods.includes(p)} disabled={exists||busy} onClick={()=>{selectionTouched.current=true;setPeriods(previous=>previous.includes(p)?previous.filter(x=>x!==p):[...previous,p].sort((a,b)=>a-b))}} className={'flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium disabled:opacity-50 '+(periods.includes(p)?'border-primary bg-primary/10 text-primary':'bg-background')}>{periods.includes(p)&&<Check className="size-4"/>}{p}교시{exists?' · 신청함':''}</button>})}</div></fieldset>
 <label className="block text-sm font-semibold">2. 교실<select required className={field} value={roomId} onChange={e=>{setRoomId(e.target.value);setSeatId('')}} disabled={busy}><option value="">교실 선택</option>{context.rooms.map(r=><option key={r.id} value={r.id}>{r.name}{r.hasSeats?'':' · 정원제'}</option>)}</select></label>
 {room?.hasSeats&&<fieldset><legend className="text-sm font-semibold">3. 자리 선택 <span className="font-normal text-muted-foreground">{seatId?'· '+(seats.find(s=>String(s.id)===seatId)?.name||'')+'번 선택':''}</span></legend><p className="mt-1 text-xs text-muted-foreground">선택한 모든 교시에 비어 있는 자리만 선택할 수 있어요.</p>{seatLoading?<p className="py-5 text-sm">좌석 확인 중…</p>:seatError?<p role="alert" className="mt-2 text-sm text-destructive">{seatError}</p>:<div className={'mt-3 grid grid-cols-5 gap-1.5 rounded-lg border bg-muted/30 p-2 '+(gridMode?'sm:[grid-template-columns:repeat(var(--seat-columns),minmax(0,1fr))]':'sm:grid-cols-8')} style={gridMode?{'--seat-columns':maxX} as React.CSSProperties:undefined}>{seats.map(s=><button key={s.id} type="button" aria-label={s.name+'번 자리'+(occupied.has(String(s.id))?' · 신청됨':'')} aria-pressed={String(s.id)===seatId} disabled={busy||occupied.has(String(s.id))||!periods.length} onClick={()=>setSeatId(String(s.id))} className={'min-h-11 min-w-0 rounded-lg border px-1 text-xs font-medium disabled:opacity-30 '+(gridMode?'sm:[grid-column:var(--seat-x)] sm:[grid-row:var(--seat-y)] ':'')+(String(s.id)===seatId?'border-primary bg-primary text-primary-foreground':'border-border bg-background hover:border-primary')} style={gridMode?{'--seat-x':s.x+1,'--seat-y':s.y+1} as React.CSSProperties:undefined}>{s.name}</button>)}</div>}</fieldset>}
 <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">담당 선생님<select required className={field} value={teacherId} onChange={e=>setTeacherId(e.target.value)} disabled={busy}><option value="">선생님 선택</option>{context.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="block text-sm font-medium">신청 사유<input required maxLength={1000} className={field} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label></div>
 <div className="rounded-2xl bg-muted p-3 text-sm">{periods.length?[...periods].sort((a,b)=>a-b).map(p=>p+'교시').join(' · '):'교시를 선택해 주세요.'}{room?' / '+room.name:''}{room?.hasSeats&&seatId?' / '+(seats.find(s=>String(s.id)===seatId)?.name||'')+'번':''}</div>
 <Button type="submit" className="min-h-12 w-full" disabled={busy||loading||!context.open||!periods.length||!room||!teacherId||room.hasSeats&&(seatLoading||!!seatError||!seatId||occupied.has(seatId))}>{busy?'공식 명단에 반영 중…':periods.length+'개 교시 신청하기'}</Button>
 </form>}
 </div></DialogContent></Dialog>
 </section>;
}
