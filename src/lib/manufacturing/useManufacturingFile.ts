'use client';
import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {ManufacturingFileLease,sameOriginManufacturingFileClient} from './fileAccess';
type Timers=Set<ReturnType<typeof setTimeout>>;
function save(controller:ManufacturingFileLease,url:string,name:string,timers:Timers){
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name||'manufacturing-file';document.body.append(anchor);anchor.click();anchor.remove();
 const timer=setTimeout(()=>{controller.release(url);timers.delete(timer)},1000);timers.add(timer);
}
/** Already-read bytes cannot be recalled; object URL cleanup prevents later reuse in this UI. */
export function useManufacturingFile(viewer:string|undefined,path:string|null|undefined){
 const fileClient=useMemo(()=>sameOriginManufacturingFileClient(supabase,undefined,viewer),[viewer]);
 const [revision,setRevision]=useState(0),[controller]=useState(()=>new ManufacturingFileLease());
 const key=JSON.stringify([viewer||'',path||'',revision]),current=useRef<string|null>(null),timers=useRef<Timers>(new Set());
 const [preview,setPreview]=useState<{key:string;url:string|null;error:string}>({key:'',url:null,error:''});
 const [busy,setBusy]=useState({key:'',value:false});
 useLayoutEffect(()=>{
  current.current=key;controller.invalidate();const ownedTimers=timers.current,live=()=>current.current===key;
  if(viewer&&path)void controller.preview(fileClient,viewer,path,live).then(url=>{if(live())setPreview({key,url,error:''})}).catch(error=>{if(live())setPreview({key,url:null,error:error instanceof Error?error.message:'파일을 불러오지 못했어요. 다시 시도해 주세요.'})});
  return()=>{current.current=null;controller.invalidate();for(const timer of ownedTimers)clearTimeout(timer);ownedTimers.clear();};
 },[controller,key,viewer,path,fileClient]);
 const reload=useCallback(()=>setRevision(value=>value+1),[]);
 const download=useCallback(async(name:string)=>{
  const live=()=>current.current===key;if(!viewer||!path||!live()||busy.key===key&&busy.value)return;setBusy({key,value:true});
  try{const url=await controller.download(fileClient,viewer,path,live);if(url&&live())save(controller,url,name,timers.current);}
  catch(error){if(live()){controller.invalidate();setPreview({key,url:null,error:error instanceof Error?error.message:'파일 다운로드 권한을 확인하지 못했어요. 다시 시도해 주세요.'});}}
  finally{if(live())setBusy({key,value:false});}
 },[viewer,path,key,busy,controller,fileClient]);
 const ready=preview.key===key;
 return{url:ready?preview.url:null,error:ready?preview.error:'',loading:!!viewer&&!!path&&!ready,downloading:busy.key===key&&busy.value,reload,download};
}
/** Click-only reads for queues; no preview or signed URL is cached between clicks. */
export function useManufacturingDownloader(viewer:string|undefined){
 const fileClient=useMemo(()=>sameOriginManufacturingFileClient(supabase,undefined,viewer),[viewer]);
 const current=useRef<string|undefined>(undefined),[controller]=useState(()=>new ManufacturingFileLease()),timers=useRef<Timers>(new Set());
 useLayoutEffect(()=>{current.current=viewer;controller.invalidate();const ownedTimers=timers.current;return()=>{current.current=undefined;controller.invalidate();for(const timer of ownedTimers)clearTimeout(timer);ownedTimers.clear();}},[viewer,controller]);
 return useCallback(async(path:string,name?:string)=>{
  if(!viewer)throw Error('CBGPU에 다시 로그인한 뒤 파일을 열어 주세요.');const live=()=>current.current===viewer;
  const url=await controller.download(fileClient,viewer,path,live);if(url&&live())save(controller,url,name||path.split('/').at(-1)||'manufacturing-file',timers.current);
 },[viewer,controller,fileClient]);
}
