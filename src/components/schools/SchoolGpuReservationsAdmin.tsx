'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dropdown} from '@/components/ui/dropdown';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {schoolGpuAdminRequest,schoolGpuTime,schoolGpuPeriod,schoolGpuStatus,schoolGpuFilters,schoolGpuActionLabels,canSchoolGpuAction,validateSchoolGpuPage,type SchoolGpuAction,type SchoolGpuAdminRow,type SchoolGpuAdminPage} from '@/lib/schoolGpuReservationsAdmin';

const filterLabels:Record<string,string>={all:'전체 상태',pending:'승인 대기',approved:'승인됨',rejected:'거절됨',reserved:'예약됨',cancelled:'취소됨',revoked:'이용 중지',active:'예약 시간 진행 중',upcoming:'시작 전',ended:'종료'};
export default function SchoolGpuReservationsAdmin({schoolId}:{schoolId:string}){
 const {user}=useAuth();
 return <Reservations key={schoolId+':'+(user?.id||'anonymous')} schoolId={schoolId} owner={user?.id}/>;
}
function Reservations({schoolId,owner}:{schoolId:string;owner?:string}){
 const [rows,setRows]=useState<SchoolGpuAdminRow[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [query,setQuery]=useState(''),[filters,setFilters]=useState({status:'all',gpu:'all',query:''}),[retry,setRetry]=useState(0),[now,setNow]=useState(Date.now()),[gpuLabels,setGpuLabels]=useState<Record<string,string>>({});
 const [review,setReview]=useState<{row:SchoolGpuAdminRow;action:SchoolGpuAction}|null>(null),[busy,setBusy]=useState(false);
 const generation=useRef(0),mounted=useRef(true),reading=useRef(false),mutating=useRef(false),clockOffset=useRef(0);
 const path='schools/'+encodeURIComponent(schoolId)+'/gpu/admin/reservations';
 const request=<T,>(url:string,method:string,body?:unknown)=>schoolGpuAdminRequest<T>(url,method,body,owner||'',async()=>(await supabase.auth.getSession()).data.session,()=>mounted.current);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()+clockOffset.current),15000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{setRows([]);setCursor(null);setReview(null);setError('');void load(false);return()=>{generation.current++;reading.current=false}},[owner,schoolId,filters,retry]);
 async function load(append:boolean){
  if(!owner||!/^[-A-Za-z0-9_]{1,100}$/.test(schoolId)||append&&!cursor||reading.current)return;
  reading.current=true;const ticket=++generation.current;setLoading(true);setError('');
  const parameters=new URLSearchParams({limit:'50',status:filters.status,gpu:filters.gpu});if(filters.query)parameters.set('q',filters.query);if(append&&cursor)parameters.set('cursor',cursor);
  try{
   const result=validateSchoolGpuPage(await request<SchoolGpuAdminPage>(path+'?'+parameters,'GET'),schoolId);
   if(!mounted.current||ticket!==generation.current)return;
   clockOffset.current=Date.parse(result.server_now)-Date.now();setNow(Date.parse(result.server_now));
   setRows(previous=>append?[...new Map([...previous,...result.items].map(row=>[row.source+':'+row.id,row])).values()]:result.items);setCursor(result.next_cursor);
   setGpuLabels(previous=>({...previous,...Object.fromEntries(result.items.map(row=>[row.gpu_id,row.gpu_label]))}));
  }catch(e){if(mounted.current&&ticket===generation.current){setRows([]);setCursor(null);setReview(null);setError(e instanceof Error?e.message:'예약을 불러오지 못했어요. 다시 조회해 주세요.')}}
  finally{if(mounted.current&&ticket===generation.current){reading.current=false;setLoading(false)}}
 }
 async function confirmAction(){
  if(!owner||!review||mutating.current||!mounted.current)return;
  const target=review;if(!canSchoolGpuAction(target.row,target.action,Date.now()+clockOffset.current)){setReview(null);setError('예약 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.');return}
  mutating.current=true;setBusy(true);setError('');setNotice('');const ticket=generation.current;
  try{
   const result=await request<{school_id:string;reservation:SchoolGpuAdminRow;server_now:string}>(path+'/'+encodeURIComponent(target.row.id)+'/action','POST',{source:target.row.source,action:target.action,expected_status:target.row.status,expected_end_time:target.row.end_time});
   if(!mounted.current||ticket!==generation.current)return;
   const checked=validateSchoolGpuPage({school_id:result.school_id,items:[result.reservation],next_cursor:null,server_now:result.server_now},schoolId);
   if(checked.items[0].id!==target.row.id||checked.items[0].source!==target.row.source)throw Error('처리된 예약을 확인하지 못했어요. 새로고침해 주세요.');
   setReview(null);setNotice(schoolGpuActionLabels[target.action]+' 처리가 저장됐어요.');setRetry(value=>value+1);
  }catch(e){if(mounted.current&&ticket===generation.current){setReview(null);setError(e instanceof Error?e.message:'처리 결과를 확인하지 못했어요. 새로고침 후 상태를 확인해 주세요.')}}
  finally{mutating.current=false;if(mounted.current)setBusy(false)}
 }
 if(!owner)return <p className="text-sm" role="status">로그인 후 학교 예약 관리 권한을 확인해 주세요.</p>;
 return <section className="min-w-0 space-y-4 text-sm" aria-label="학교 GPU 예약 관리">
  <header className="space-y-2"><h2 className="text-lg font-semibold">GPU 예약</h2><p className="text-sm text-muted-foreground">현재 학교의 예약과 이용 기록을 확인해요. 학교 GPU의 ‘예약됨’은 승인 대기 상태가 아니에요.{schoolId==='cbsh'?' CBSH 기존 GPU 예약도 함께 표시해요.':''}</p></header>
  <form className="flex min-w-0 flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();setFilters(value=>({...value,query:query.trim()}));setNotice('')}}>
   <div className="flex w-full min-w-0 items-end gap-3 sm:flex-1"><label className="grid min-w-0 flex-1 gap-2"><span>예약 검색</span><Input value={query} maxLength={150} onChange={event=>setQuery(event.target.value)} placeholder="이름, 학번, 이용 목적" className="min-h-11" disabled={busy}/></label>
   <Button type="submit" className="min-h-11" disabled={busy}>검색</Button></div>
   <label className="grid min-w-0 gap-2"><span>상태</span><Dropdown aria-label="예약 상태" className="min-h-11" value={filters.status} disabled={busy} onChange={event=>setFilters(value=>({...value,status:event.target.value}))}>{schoolGpuFilters.map(status=><option key={status} value={status}>{filterLabels[status]}</option>)}</Dropdown></label>
   <label className="grid min-w-0 gap-2"><span>GPU</span><Dropdown aria-label="예약 GPU" className="min-h-11 max-w-full" value={filters.gpu} disabled={busy} onChange={event=>setFilters(value=>({...value,gpu:event.target.value}))}><option value="all">모든 GPU</option>{Object.entries(gpuLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Dropdown></label>
   <Button type="button" variant="outline" className="min-h-11" disabled={loading||busy} onClick={()=>{setNotice('');setRetry(value=>value+1)}}>새로고침</Button>
  </form>
  {error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
  <p role="status" className="text-sm text-muted-foreground">{loading?'예약을 불러오는 중…':error?'조회 결과를 확인하지 못했어요. 새로고침해 주세요.':`${rows.length}건 조회${cursor?' · 이전 기록을 더 불러올 수 있어요.':' · 조회한 조건의 마지막 기록이에요.'}`}</p>
  <div className="grid min-w-0 gap-4 xl:grid-cols-2">{rows.map(row=><article key={row.source+':'+row.id} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4" aria-label={row.gpu_label+' 예약'}>
   <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-base font-semibold">{row.owner.full_name||'이름 정보 없음'}</h3><p className="break-words text-sm text-muted-foreground">{row.owner.student_number||'학번 정보 없음'}</p></div><span className="break-words text-sm font-semibold">{row.gpu_label}</span></div>
   <p className="flex flex-wrap gap-2"><span>{schoolGpuStatus(row.status)}</span><span className="text-muted-foreground">· {schoolGpuPeriod(row.start_time,row.end_time,now)}</span></p>
   <p className="break-words text-sm">{schoolGpuTime(row.start_time)} → {schoolGpuTime(row.end_time)}</p>
   <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">이용 목적 · {row.purpose||'입력된 목적 없음'}</p>
   <p className="text-sm text-muted-foreground">{row.source==='legacy'?'CBSH 기존 GPU':'학교 GPU 노드'}</p>
   {row.source==='legacy'&&row.status==='pending'&&Date.parse(row.end_time)>now&&!row.allowed_actions.includes('approve')&&<p className="text-sm text-muted-foreground">현재 승인할 수 없어요. GPU 이용 상황과 예약자의 이용 권한을 확인해 주세요.</p>}
   <div className="flex flex-wrap gap-2">{row.allowed_actions.filter(action=>canSchoolGpuAction(row,action,now)).map(action=><Button key={action} type="button" variant="outline" className="min-h-11" disabled={busy||loading} onClick={()=>setReview({row,action})}>{schoolGpuActionLabels[action]}</Button>)}</div>
  </article>)}</div>
  {!loading&&!error&&!rows.length&&<p className="py-6 text-sm text-muted-foreground">조건에 맞는 예약이 없어요. 검색어와 필터를 확인해 주세요.</p>}
  {cursor&&<Button type="button" variant="outline" className="min-h-11" disabled={loading||busy} onClick={()=>void load(true)}>이전 예약 불러오기</Button>}
  <Dialog open={!!review} onOpenChange={open=>{if(!open&&!busy)setReview(null)}}><DialogContent><DialogHeader><DialogTitle>{review?schoolGpuActionLabels[review.action]+'할까요?':'예약 처리'}</DialogTitle><DialogDescription>{review?.row.gpu_label} · {review?.row.owner.full_name||'예약자'}님의 예약이에요. {review?.action==='approve'?'승인 후 예약 시간에 GPU를 이용할 수 있어요.':review?.action==='reject'?'예약을 거절해요. 기록은 보관돼요.':'예약 이용 권한이 종료되고 실행 중인 노트북이 중지될 수 있어요. 저장하지 않은 작업을 확인해 주세요. 기록은 보관돼요.'}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={()=>setReview(null)}>돌아가기</Button><Button type="button" className="min-h-11" disabled={busy} onClick={()=>void confirmAction()}>{busy?'처리 중…':review?schoolGpuActionLabels[review.action]:'확인'}</Button></DialogFooter></DialogContent></Dialog>
 </section>;
}
