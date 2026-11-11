'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {aiRequest} from '@/lib/aiClient';

export type PreparedFile = {
  id:string;
  state:'new'|'processing'|'ready'|'failed';
  progress?:number;
  pages?:number;
  ocr_pages?:number;
  weak_pages?:number[];
  empty_pages?:number[];
  truncated?:boolean;
  error?:string;
};
export type Attachment = {
  key:string;
  file:File;
  status:'uploading'|'processing'|'ready'|'failed';
  prepared?:PreparedFile;
  error?:string;
};

function pause(milliseconds:number,signal:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},milliseconds);
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();
  });
}

export function useAiAttachments(ownerId:string|undefined){
  const [files,setFiles]=useState<Attachment[]>([]);
  const active=useRef(new Map<string,AbortController>());
  const owner=useRef(ownerId);
  owner.current=ownerId;
  const reset=useCallback(()=>{
    for(const abort of active.current.values())abort.abort();
    active.current.clear();setFiles([]);
  },[]);
  useEffect(()=>{reset();return reset},[ownerId,reset]);

  const prepare=useCallback(async(item:Attachment)=>{
    if(!ownerId)return;
    const abort=new AbortController();
    active.current.get(item.key)?.abort();
    active.current.set(item.key,abort);
    const update=(change:Partial<Attachment>)=>{
      if(!abort.signal.aborted&&owner.current===ownerId){
        setFiles(current=>current.map(file=>file.key===item.key?{...file,...change}:file));
      }
    };
    const request=(path:string,method='GET',body?:unknown)=>
      aiRequest(path,method,body,abort.signal,ownerId);
    try{
      let id=item.prepared?.id;
      update({status:id?'processing':'uploading',error:undefined});
      if(!id){
        const result=await request('/uploads?name='+encodeURIComponent(item.file.name),'POST',item.file);
        id=result.id;
        update({status:'processing',prepared:{id:id!,state:'new'}});
      }
      let prepared:PreparedFile|undefined;
      const deadline=Date.now()+300_000;
      while(Date.now()<deadline){
        try{
          prepared=(await request('/uploads/'+id+'/prepare','POST',{})).file;
          break;
        }catch(error){
          if((error as Error&{status?:number}).status!==429)throw error;
          await pause(8000,abort.signal);
        }
      }
      if(!prepared)throw Error('파일 처리를 기다리고 있어요. 잠시 후 다시 시도해 주세요.');
      let state:PreparedFile=prepared;
      while(state.state==='processing'){
        update({status:'processing',prepared:state});
        if(Date.now()>=deadline)throw Error('파일 처리 시간이 길어지고 있어요. 다시 시도해 주세요.');
        await pause(8000,abort.signal);
        state=(await request('/uploads/'+id)).file as PreparedFile;
      }
      if(state.state!=='ready')throw Error(state.error||'파일을 읽지 못했어요.');
      update({status:'ready',prepared:state,error:undefined});
    }catch(error){
      if(!abort.signal.aborted)update({status:'failed',error:(error as Error).message});
    }finally{
      if(active.current.get(item.key)===abort)active.current.delete(item.key);
    }
  },[ownerId]);

  function attach(incoming:FileList|File[]|null,storedCount:number){
    if(!incoming?.length)return;
    const selected=Array.from(incoming);
    if(files.length+selected.length+storedCount>3){
      throw Error('파일은 프로젝트 자료를 포함해 최대 3개까지 첨부할 수 있어요.');
    }
    if(selected.some(file=>!file.size||file.size>8*1024*1024||
      !/\.(pdf|png|jpe?g|webp|tiff?|csv|txt|md|json|tex|py|log)$/i.test(file.name))){
      throw Error('8MB 이하의 PDF, 이미지, CSV 또는 텍스트 파일을 올려 주세요.');
    }
    const additions=selected.map(file=>({key:crypto.randomUUID(),file,status:'uploading' as const}));
    setFiles(current=>[...current,...additions]);
    for(const item of additions)void prepare(item);
  }
  function remove(key:string){
    const id=files.find(file=>file.key===key)?.prepared?.id;
    active.current.get(key)?.abort();
    active.current.delete(key);
    if(id&&ownerId)void aiRequest('/uploads/'+id,'DELETE',undefined,undefined,ownerId).catch(()=>{});
    setFiles(current=>current.filter(file=>file.key!==key));
  }
  return {files,attach,remove,reset,retry:(file:Attachment)=>void prepare(file),
    waiting:files.some(file=>file.status==='uploading'||file.status==='processing'),
    failed:files.some(file=>file.status==='failed')};
}
