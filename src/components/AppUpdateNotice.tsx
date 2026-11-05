'use client';
import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
import {onNativeBridgeReady,type NativeBridge} from '@/lib/nativeBridge';
import {androidRelease,shouldOfferAndroidUpdate,type AndroidRelease} from '@/lib/appUpdates';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
const SNOOZE=24*60*60_000;
export default function AppUpdateNotice(){
 const [release,setRelease]=useState<AndroidRelease|null>(null),[open,setOpen]=useState(false);
 useEffect(()=>{
  let disposed=false,inFlight=false,lastCheck=0;let bridge:NativeBridge|undefined;
  async function check(){
   if(!bridge||bridge.platform!=='android'||inFlight||document.visibilityState==='hidden'||Date.now()-lastCheck<60_000)return;
   inFlight=true;lastCheck=Date.now();
   try{
    const response=await fetch('/api/app-release',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)return;
    const latest=androidRelease(await response.json());if(!latest)return;
    let installed:null|{platform:string;buildNumber:number}=null;
    if(bridge.getAppInfo)installed=await Promise.race([bridge.getAppInfo(),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('Version unavailable')),5000))]);
    if(!shouldOfferAndroidUpdate(latest,installed,!bridge.getAppInfo))return;
    let snoozed=false;try{snoozed=Date.now()-Number(localStorage.getItem('cbgpu-update-snooze:'+latest.buildNumber)||0)<SNOOZE}catch{}
    if(!disposed&&!snoozed){setRelease(latest);setOpen(true)}
   }catch{/* Offline or unreadable versions must not interrupt use of the app. */}finally{inFlight=false}
  }
  const unsubscribe=onNativeBridgeReady(value=>{bridge=value;void check()});
  const visible=()=>{if(document.visibilityState==='visible')void check()};
  document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>void check(),30*60_000);
  return()=>{disposed=true;unsubscribe();document.removeEventListener('visibilitychange',visible);clearInterval(timer)};
 },[]);
 function dismiss(){if(release)try{localStorage.setItem('cbgpu-update-snooze:'+release.buildNumber,String(Date.now()))}catch{}setOpen(false)}
 if(!release)return null;
 return <Dialog open={open} onOpenChange={value=>{if(!value)dismiss()}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md"><DialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Download/></div><DialogTitle>새로운 CBGPU 앱이 있어요</DialogTitle><DialogDescription>v{release.version}으로 업데이트하고 최신 기능을 이용하세요.</DialogDescription></DialogHeader>{release.notes&&<p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{release.notes}</p>}<p className="text-xs text-muted-foreground">설치 파일을 다운로드한 뒤 Android 설치 화면에서 업데이트해 주세요. 기존 앱을 삭제할 필요는 없어요.</p><DialogFooter><Button variant="outline" onClick={dismiss}>나중에</Button><Button asChild><a href={release.downloadUrl} onClick={dismiss}><Download className="size-4"/>업데이트</a></Button></DialogFooter></DialogContent></Dialog>;
}
