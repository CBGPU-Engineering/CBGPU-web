'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowUp,ArrowUpRight,Clock3,Loader2,Sparkles,Square,X} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {aiRequest} from '@/lib/aiClient';
import {watchChat} from '@/lib/aiChatStream';
import {useAuth} from '@/lib/useAuth';
import {serviceDestination} from '@/lib/serviceDiscovery';
import {useWorkspace,useIsAppWorkspace} from './WorkspaceShell';

type Message={
 id:string;role:string;content:string;state:string;truncated?:boolean;job_id?:string;error?:string;
 sources?:{title:string;url:string;kind?:string;checked_at?:string}[];
};
type Chat={id:string;messages:Message[]};
const live=(message:Message)=>['queued','running','paused'].includes(message.state);
const examples=['오늘 점심 뭐야?','내 프린팅 신청 상태','서버 배포는 어떻게 해?'];

export default function HomeAiSearch(){
 const {user,isApproved}=useAuth();
 const mode=useWorkspace(),isApp=useIsAppWorkspace();
 const [question,setQuestion]=useState('');
 const [asked,setAsked]=useState('');
 const [chat,setChat]=useState<Chat|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [checked,setChecked]=useState('');
 const owner=useRef(user?.id);owner.current=user?.id;
 const version=useRef(0);
 const input=useRef<HTMLInputElement>(null);
 const abort=useRef<AbortController|null>(null);
 const latest=chat?.messages.findLast(message=>message.role==='assistant');
 const pending=latest&&live(latest);

 useEffect(()=>{
  version.current++;abort.current?.abort();setChat(null);setQuestion('');setAsked('');setBusy(false);setError('');setChecked('');
  return()=>{abort.current?.abort()};
 },[user?.id]);

 useEffect(()=>{
  if(!chat||!pending||!user)return;
  const expected=user.id,id=chat.id,controller=new AbortController();
  let active=true,syncing=false,streaming=false;
  abort.current=controller;
  void watchChat(id,expected,controller.signal,event=>{
   if(!active||owner.current!==expected)return;
   streaming=true;
   setChat(current=>{
    if(!current||current.id!==id)return current;
    return {...current,messages:current.messages.map(message=>{
     if(event.id!==message.id&&(!event.message||typeof event.message!=='object'||event.message.id!==message.id))return message;
     if(event.type==='delta')return {...message,content:message.content.slice(0,event.offset??message.content.length)+(event.text||'')};
     if(event.type==='replace')return {...message,content:event.text||''};
     if(typeof event.message==='object')return {...message,...event.message} as Message;
     return message;
    })};
   });
  }).catch(()=>{}).finally(()=>{streaming=false});
  const timer=setInterval(async()=>{
   if(syncing||streaming)return;
   syncing=true;
   try{
    const result=await aiRequest('/chats/'+id,'GET',undefined,controller.signal,expected);
    if(active&&owner.current===expected)setChat(result.chat);
   }catch(error){
    if(active&&(error as Error).name!=='AbortError')setError((error as Error).message);
   }finally{syncing=false}
  },6000);
  return()=>{active=false;controller.abort();clearInterval(timer)};
 },[chat?.id,pending,user?.id]);

 async function ask(value=question){
  if(!value.trim()||busy||pending||!user||!isApproved)return;
  const expected=user.id,current=++version.current,controller=new AbortController();
  abort.current?.abort();abort.current=controller;
  setBusy(true);setError('');
  try{
   const result=await aiRequest('/site-ask','POST',{question:value.trim(),chat_id:chat?.id},controller.signal,expected);
   if(owner.current!==expected||current!==version.current)return;
   setChat(result.chat);setAsked(value.trim());setQuestion('');setChecked(result.checked_at);
  }catch(error){
   if(owner.current===expected&&current===version.current&&(error as Error).name!=='AbortError')setError((error as Error).message);
  }finally{
   if(owner.current===expected&&current===version.current)setBusy(false);
  }
 }
 async function stop(){
  if(busy){version.current++;abort.current?.abort();setBusy(false);return}
  if(!latest?.job_id||!chat)return;
  const expected=user?.id;
  try{
   await aiRequest('/jobs/'+latest.job_id+'/cancel','POST',{},undefined,expected);
   const result=await aiRequest('/chats/'+chat.id,'GET',undefined,undefined,expected);
   if(owner.current===expected)setChat(result.chat);
  }catch(error){if(owner.current===expected)setError((error as Error).message)}
 }
 function clear(){
  version.current++;abort.current?.abort();setChat(null);setAsked('');setChecked('');setError('');
 }
 const destination=(url:string)=>{
  try{
   const value=new URL(url,'https://cbgpu.com');
   if(['cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','app.cbgpu.com'].includes(value.hostname)){
    return serviceDestination(value.pathname+value.search,mode,isApp);
   }
   return url;
  }catch{return '/services'}
 };
 return <section className="cb-home-ask" aria-label="CBGPU에 물어보기">
  <form onSubmit={event=>{event.preventDefault();void ask()}}>
   <Link href={serviceDestination('/ai',mode,isApp)} aria-label="CBGPU AI에게 물어보기" title="CBGPU AI 열기"><Sparkles size={20} aria-hidden="true"/></Link>
   <input ref={input} type="search" aria-label="CBGPU 정보 질문" placeholder="CBGPU에 궁금한 걸 물어보세요" value={question}
    maxLength={1000} onChange={event=>setQuestion(event.target.value)} disabled={!user||!isApproved}/>
   {busy||pending?<button type="button" aria-label="홈 AI 답변 중지" onClick={()=>void stop()}><Square size={15}/></button>:
    <button type="submit" aria-label="CBGPU에 질문하기" disabled={!question.trim()||!user||!isApproved}><ArrowUp size={19}/></button>}
  </form>
  {!asked&&!busy&&<div className="cb-home-ask-examples">{examples.map(example=>
   <button key={example} type="button" disabled={!user||!isApproved} onClick={()=>void ask(example)}>{example}<ArrowUpRight size={11}/></button>
  )}</div>}
  {busy&&<p className="cb-home-ask-progress" role="status"><Loader2 size={15} className="animate-spin"/>관련된 CBGPU 정보를 확인하고 있어요…</p>}
  {error&&<p className="cb-home-ask-error" role="alert">{error}</p>}
  {chat&&<div className="cb-home-answer">
   <header><strong>{asked}</strong><button type="button" aria-label="홈 AI 답변 접기" disabled={!!pending||busy} onClick={clear}><X size={17}/></button></header>
   {checked&&<p className="cb-home-answer-time"><Clock3 size={12}/>{new Date(checked).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 조회</p>}
   <div className="cb-home-answer-body">
    {latest?.content?<Markdown remarkPlugins={[remarkGfm]} skipHtml components={{img:()=>null}}>{latest.content}</Markdown>:
     <p role="status"><Loader2 size={15} className="animate-spin"/>{pending?'확인한 정보로 답변을 작성하고 있어요…':latest?.error||'답변이 중단됐어요. 다시 질문해 주세요.'}</p>}
   </div>
   {(latest?.truncated||latest?.content&&['failed','cancelled'].includes(latest.state))&&<p className="cb-home-ask-error">답변의 일부만 생성됐어요. 관련 화면에서 확인하거나 다시 질문해 주세요.</p>}
   {!!latest?.sources?.length&&<nav className="cb-home-answer-sources" aria-label="홈 AI 정보 출처">{latest.sources.map((source,index)=>
    <Link key={index} href={destination(source.url)}><span>{index+1}</span>{source.title}<ArrowUpRight size={12}/></Link>
   )}</nav>}
   <footer><span>조회 이후 상태가 바뀔 수 있어요.</span><Link href={serviceDestination('/ai?c='+chat.id,mode,isApp)}>AI에서 이어서 대화<ArrowUpRight size={13}/></Link></footer>
  </div>}
 </section>;
}
