'use client';
import {useEffect,useRef,useState} from 'react';
import {ClockPlus,RefreshCw} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {useAlert} from '@/lib/alert';
import {extensionEndError,gpuExtensionReason,requestGpuExtension,type GpuExtensionPreview} from '@/lib/gpuReservationExtension';
const localTime=(time:number)=>{const date=new Date(time);return new Date(time-date.getTimezoneOffset()*60000).toISOString().slice(0,19)};
const display=(value:string)=>new Date(value).toLocaleString('ko-KR',{dateStyle:'medium',timeStyle:'short'});
type Props={reservationId:string;apiBase:string;onExtended:(end:string)=>void;disabled?:boolean};
export default function GpuReservationExtension(props:Props){const{user}=useAuth();return <Extension key={`${user?.id}:${props.apiBase}`} {...props}/>;}
function Extension({reservationId,apiBase,onExtended,disabled=false}:Props){
 const{user}=useAuth(),{showSuccess}=useAlert();const[open,setOpen]=useState(false),[preview,setPreview]=useState<GpuExtensionPreview|null>(null),[end,setEnd]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reading,setReading]=useState(false);
 const state=useRef({live:true,actor:user?.id,generation:0,controller:null as AbortController|null,saving:false});
 useEffect(()=>{const current=state.current;current.live=true;return()=>{current.live=false;current.generation++;current.controller?.abort()}},[]);
 const lease=(owner:string|undefined,ticket:number)=>()=>!!owner&&state.current.live&&state.current.actor===owner&&state.current.generation===ticket;
 async function load(keepEnd=false){
  if(state.current.saving)return;state.current.controller?.abort();const controller=new AbortController();state.current.controller=controller;const ticket=++state.current.generation,owner=user?.id,current=lease(owner,ticket);setReading(true);setError('');setPreview(null);
  try{if(!owner)throw Error(gpuExtensionReason('AUTHENTICATION_REQUIRED'));const result=await requestGpuExtension({base:apiBase,id:reservationId,owner,current,session:()=>supabase.auth.getSession(),signal:controller.signal});if(!current())return;setPreview(result);const target=Math.min(Date.parse(result.current_end)+3600000,result.max_end?Date.parse(result.max_end):Infinity);setEnd(previous=>keepEnd&&!extensionEndError(previous,result)?previous:localTime(target));}
  catch(e){if(current()&&!controller.signal.aborted)setError(e instanceof Error?e.message:gpuExtensionReason(null))}
  finally{if(current())setReading(false)}
 }
 async function submit(event:React.FormEvent){event.preventDefault();if(state.current.saving||!preview?.can_extend)return;const validation=extensionEndError(end,preview);if(validation){setError(validation);return}const owner=user?.id,ticket=state.current.generation,current=lease(owner,ticket);if(!owner)return;state.current.saving=true;setBusy(true);setError('');
  try{const result=await requestGpuExtension({base:apiBase,id:reservationId,owner,current,session:()=>supabase.auth.getSession(),endsAt:new Date(end).toISOString(),expectedEnd:preview.current_end});if(!current())return;onExtended(result.current_end);showSuccess('GPU 사용 시간이 연장됐어요.');setOpen(false);setPreview(null)}
  catch(e){if(current()){setError(e instanceof Error?e.message:gpuExtensionReason(null));setPreview(null)}}finally{state.current.saving=false;if(current())setBusy(false)}
 }
 const close=()=>{if(state.current.saving)return;state.current.generation++;state.current.controller?.abort();setOpen(false);setPreview(null);setError('');setReading(false)};
 return <Dialog open={open} onOpenChange={value=>{if(!value)close()}}><DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled||!user} className="min-h-11 shrink-0 gap-2" onClick={()=>{setOpen(true);void load()}}><ClockPlus className="size-4"/>사용 연장</Button></DialogTrigger><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>GPU 사용 연장</DialogTitle><DialogDescription>현재 예약의 종료 시간을 늘려요. 다른 예약과 겹치거나 이용 권한 기간을 넘으면 연장할 수 없어요.</DialogDescription></DialogHeader>{reading&&<p role="status" className="text-sm text-muted-foreground">연장 가능한 시간을 확인하고 있어요…</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{preview&&<div className="space-y-2 text-sm"><p>현재 종료 · <strong>{display(preview.current_end)}</strong></p>{preview.max_end&&Date.parse(preview.max_end)>Date.parse(preview.current_end)&&<p>최대 연장 · <strong>{display(preview.max_end)}</strong></p>}{!preview.can_extend&&<p role="status">{preview.reason==='RESERVATION_CONFLICT'?'다른 예약이 이어져 있어 더 연장할 수 없어요.':preview.reason==='EXTENSION_LIMIT'?'학교의 이용 가능 시간 한도에 도달해 더 연장할 수 없어요.':gpuExtensionReason(preview.reason)}</p>}</div>}{preview?.can_extend&&<form className="space-y-4" onSubmit={submit}><label className="grid gap-2 text-sm font-medium">새 종료 시간<Input className="min-h-11" type="datetime-local" step={1} required value={end} min={localTime(Date.parse(preview.current_end)+1000)} max={preview.max_end?localTime(Date.parse(preview.max_end)):undefined} disabled={busy} onChange={event=>setEnd(event.target.value)}/></label><div className="flex flex-wrap gap-2">{[30,60,180].map(minutes=>{const target=Date.parse(preview.current_end)+minutes*60000;return <Button key={minutes} type="button" variant="outline" disabled={busy||!!preview.max_end&&target>Date.parse(preview.max_end)} onClick={()=>setEnd(localTime(target))}>{minutes<60?`${minutes}분`:`${minutes/60}시간`} 연장</Button>})}</div><p className="text-sm text-muted-foreground">연장 버튼을 누를 때 예약 상황을 다시 확인해요. 그사이에 다른 예약이 생기면 연장되지 않아요.</p><DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={close}>닫기</Button><Button type="submit" disabled={busy}>{busy?'연장 확인 중…':'사용 시간 연장하기'}</Button></DialogFooter></form>}{!reading&&!preview?.can_extend&&<DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={close}>닫기</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>void load(true)}><RefreshCw className="mr-2 size-4"/>다시 확인</Button></DialogFooter>}</DialogContent></Dialog>;
}
