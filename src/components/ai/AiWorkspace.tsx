'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useTheme} from 'next-themes';
import {Dialog,DropdownMenu} from 'radix-ui';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Bot,ArrowDown,ArrowUp,Check,ChevronDown,Code2,Globe,Mic,Cpu,KeyRound,WandSparkles,Copy,FileText,FlaskConical,Home,Loader2,MessageSquare,MoreHorizontal,Moon,PanelLeft,Paperclip,Download,PenLine,Search,Square,Sun,Trash2,X} from 'lucide-react';
import {chatModels} from '@/lib/aiModels';
import AiToolsPanel from './AiToolsPanel';
import CliGuide from './CliGuide';
import RoboticsGuide from './RoboticsGuide';
import EffortControl from './EffortControl';
import {useAiAttachments} from './useAiAttachments';
import CsvChart,{type CsvSeries} from './CsvChart';
import {watchChat} from '@/lib/aiChatStream';
import {aiRequest,saveAiBlob} from '@/lib/aiClient';
import {useAlert} from '@/lib/alert';
import {useAuth} from '@/lib/useAuth';
import './chat.css';

type Source={title:string;url?:string;snippet?:string;page?:number|null;excerpt?:string;charts?:CsvSeries[];ocr?:boolean;low_confidence?:boolean;truncated?:boolean};
type Message={sources?:Source[];id:string;role:'user'|'assistant';content:string;job_id?:string;state:string;error?:string;progress?:string;truncated?:boolean};
type Project={id:string;title:string;files:{id:string;name:string}[]};
type Chat={project?:string|null;effort?:string;model?:string;id:string;title:string;updated:number;messages:Message[];context_truncated?:boolean};
type Summary=Pick<Chat,'id'|'title'|'updated'|'project'>;
function chatUrl(id=''){const url=new URL(location.href);url.pathname='/ai';url.searchParams.delete('tool');url.searchParams.delete('tab');if(id)url.searchParams.set('c',id);else url.searchParams.delete('c');window.history.replaceState(null,'',url.pathname+url.search)}
const live=(m:Message)=>['queued','running','paused'].includes(m.state);
const suggestions=[{icon:FileText,title:'복잡한 글, 짧게 정리하기',prompt:'아래 글의 핵심과 근거를 읽기 쉽게 요약해 줘.\n\n'},{icon:Code2,title:'막힌 코드, 같이 풀어보기',prompt:'아래 코드가 어떻게 작동하는지 설명하고 오류를 찾아줘.\n\n'},{icon:FlaskConical,title:'연구 아이디어 구체화하기',prompt:'관심 있는 연구 주제로 실험 계획을 세우고 싶어. 먼저 필요한 질문을 해 줘.'},{icon:PenLine,title:'내 생각을 자연스러운 글로',prompt:'내 생각을 명확하고 자연스러운 글로 다듬는 걸 도와줘.\n\n'}];

function CopyButton({text,label='복사'}:{text:string;label?:string}){
 const [copied,setCopied]=useState(false);
 return <button type="button" className="chat-icon" aria-label={copied?'복사 완료':label} title={label} onClick={()=>void navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800)}).catch(()=>setCopied(false))}>{copied?<Check size={15}/>:<Copy size={15}/>}</button>;
}
function Answer({text}:{text:string}){
 return <div className="chat-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{img:()=>null,a:({href,children})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,pre:({children})=>{const child=children as React.ReactElement<{children?:string;className?:string}>;const text=typeof child?.props?.children==='string'?child.props.children:'';const language=child?.props?.className?.replace('language-','')||'code';return <div className="chat-code"><div><span>{language}</span><CopyButton text={text} label="코드 복사"/></div><pre>{children}</pre></div>},table:({children})=><div className="chat-table"><table>{children}</table></div>}}>{text}</Markdown></div>;
}

function MessageSources({sources}:{sources:Source[]}){
 const web=sources.filter(source=>source.url);
 const files=sources.filter(source=>source.excerpt);
 if(!sources.length)return null;
 return <section className="chat-evidence" aria-label="답변 근거">
  <header><FileText size={14}/><span>참고한 자료</span><small>{sources.length}개</small></header>
  {!!web.length&&<div className="chat-sources" aria-label="웹 검색 출처">{web.map((source,i)=>
   <a href={source.url} key={source.url} target="_blank" rel="noopener noreferrer">
    <span>{i+1}</span><span>{source.title}<small>{new URL(source.url!).hostname}</small></span>
   </a>)}</div>}
  {!!files.length&&<div className="chat-file-sources" aria-label="첨부 자료 근거">{files.map((source,i)=>
   <div className="chat-evidence-file" key={i}>
    <details><summary><span>파일 {i+1}</span><strong>{source.title}</strong>{source.page&&<small>{source.page}쪽</small>}</summary>
     {source.ocr&&<span className="chat-source-method">OCR로 인식한 글자</span>}
     <p>{source.excerpt}</p>
    </details>
    {source.low_confidence&&<p className="chat-source-warning">인식 정확도가 낮을 수 있어요. 숫자와 고유명사를 확인해 주세요.</p>}
    {source.truncated&&<p className="chat-source-warning">문서가 길어 일부 텍스트만 읽었어요.</p>}
    {!!source.charts?.length&&<CsvChart series={source.charts} filename={source.title}/>}
   </div>
  )}</div>}
 </section>;
}

export default function AiWorkspace(){
 const {user,isLoading,isApproved}=useAuth(),{resolvedTheme,setTheme}=useTheme(),{confirm}=useAlert();
 useEffect(()=>{const pointer=()=>{document.documentElement.dataset.cbgpuAiInput='pointer'};const key=(e:KeyboardEvent)=>{if(e.key==='Tab'||e.key.startsWith('Arrow'))document.documentElement.dataset.cbgpuAiInput='keyboard'};pointer();document.addEventListener('pointerdown',pointer,true);document.addEventListener('pointermove',pointer,true);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('pointermove',pointer,true);document.removeEventListener('keydown',key,true);delete document.documentElement.dataset.cbgpuAiInput}},[]);
 const params=useSearchParams(),queryKey=params.toString();
 const [tool,setTool]=useState('');
 const [webSearch,setWebSearch]=useState(true);
 const [research,setResearch]=useState(false);
 const [effort,setEffort]=useState('medium');
 const [projects,setProjects]=useState<Project[]>([]);
 const [projectId,setProjectId]=useState('');
 const [projectDialog,setProjectDialog]=useState(false);
 const [projectTitle,setProjectTitle]=useState('');
 const [preview,setPreview]=useState<{name:string;text:string;loading:boolean}|null>(null);
 const [projectBusy,setProjectBusy]=useState(false);
 const project=projects.find(item=>item.id===projectId);
 const attachments=useAiAttachments(user?.id);
 const {files}=attachments;
 const fileInput=useRef<HTMLInputElement>(null);
 const [model,setModel]=useState('cbgpu-chat');
 const [chats,setChats]=useState<Summary[]>([]),[chat,setChat]=useState<Chat|null>(null),[draft,setDraft]=useState(''),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sidebar,setSidebar]=useState(true),[mobile,setMobile]=useState(false),[jump,setJump]=useState(false),[rename,setRename]=useState<Summary|null>(null),[title,setTitle]=useState('');
 const liveStream=useRef<AbortController|null>(null);
 const owner=useRef(user?.id);owner.current=user?.id;const selected=useRef('');const generation=useRef(0),textarea=useRef<HTMLTextAreaElement>(null),scroll=useRef<HTMLDivElement>(null),stick=useRef(true);
 const pending=chat?.messages.findLast(live),messages=chat?.messages||[];
 const toolItems=[{id:'prompt',name:'프롬프트 최적화',icon:WandSparkles},{id:'voice',name:'음성 전사',icon:Mic},{id:'search',name:'자료 검색',icon:Search},{id:'gpu',name:'GPU 작업',icon:Cpu},{id:'api',name:'API 키 · 모델',icon:KeyRound},{id:'cli',name:'CLI 에이전트',icon:Code2},{id:'robotics',name:'Robotics',icon:Bot}];
 function chooseTool(id:string){setTool(id);setMobile(false);const url=new URL(location.href);url.pathname='/ai';url.searchParams.delete('tab');if(id)url.searchParams.set('tool',id);else url.searchParams.delete('tool');window.history.replaceState(null,'',url.pathname+url.search)}
 useEffect(()=>{const query=new URLSearchParams(queryKey);const id=query.get('tool')||query.get('tab')||'';setTool(['prompt','voice','search','gpu','api','cli','robotics'].includes(id)?id:'')},[queryKey]);

 const request=useCallback((path:string,method='GET',body?:unknown)=>aiRequest(path,method,body,undefined,user?.id),[user?.id]);
 const refreshList=useCallback(async()=>{const expected=user?.id;const data=await request('/chats');if(owner.current===expected)setChats(data.chats)},[request,user?.id]);
 const refreshProjects=useCallback(async()=>{
  const expected=user?.id;
  const value=await request('/projects');
  if(owner.current===expected)setProjects(value.projects);
 },[request,user?.id]);
 const openChat=useCallback(async(id:string)=>{const expected=user?.id,version=++generation.current;selected.current=id;setTool('');chatUrl(id);setMobile(false);setError('');setLoading(true);setChat(null);setDraft('');attachments.reset();try{const {chat}=await request('/chats/'+id);if(owner.current===expected&&version===generation.current){setChat(chat);setProjectId(chat.project||'');setWebSearch(!chat.project);setResearch(false);setModel(chat.model||'cbgpu-chat');setEffort(chat.effort||'medium');stick.current=true}}catch(e){if(owner.current===expected&&version===generation.current)setError((e as Error).message)}finally{if(version===generation.current)setLoading(false)}},[request,user?.id]);
 useEffect(()=>{generation.current++;selected.current='';setChat(null);setChats([]);setProjects([]);setProjectId('');setPreview(null);setDraft('');attachments.reset();setBusy(false);setError('');if(!user||!isApproved){setLoading(false);return}let active=true;setLoading(true);void (async()=>{try{await refreshList();void refreshProjects().catch(()=>{});if(!active)return;const id=new URL(location.href).searchParams.get('c');if(id&&/^[a-f0-9-]{36}$/.test(id)){const wanted=new URL(location.href).searchParams.get('tool');await openChat(id);if(wanted)chooseTool(wanted)}else setLoading(false)}catch(e){if(active){setError((e as Error).message);setLoading(false)}}})();return()=>{active=false}},[user?.id,isApproved,refreshList,refreshProjects,openChat]);
 useEffect(()=>{if(!pending||!chat)return;const id=chat.id,expected=user?.id;let active=true,running=false;const sync=async()=>{if(running||(liveStream.current&&!liveStream.current.signal.aborted))return;running=true;try{const data=await request('/chats/'+id);if(active&&selected.current===id&&owner.current===expected){setChat(data.chat);setError('');if(!data.chat.messages.some(live))void refreshList().catch(()=>{})}}catch(e){if(active&&selected.current===id)setError((e as Error).message)}finally{running=false}};const timer=setInterval(()=>void sync(),3000);return()=>{active=false;clearInterval(timer)}},[pending?.id,chat?.id,user?.id,request,refreshList]);
 useEffect(()=>{if(!pending||!chat||!user)return;const abort=new AbortController(),id=chat.id,expected=user.id;liveStream.current=abort;void watchChat(id,expected,abort.signal,event=>{if(owner.current!==expected||selected.current!==id||abort.signal.aborted)return;setChat(current=>{if(!current||current.id!==id)return current;const rows=current.messages.map(message=>{if(event.type==='delta'&&message.id===event.id)return {...message,content:(message.content||'').slice(0,event.offset??message.content.length)+(event.text||'')};if(event.type==='replace'&&message.id===event.id)return {...message,content:event.text||''};if((event.type==='state'||event.type==='done')&&event.message&&typeof event.message==='object'&&event.message.id===message.id)return {...message,...event.message} as Message;return message});return {...current,messages:rows}})}).catch(()=>{}).finally(()=>{if(liveStream.current===abort)liveStream.current=null});return()=>abort.abort()},[pending?.id,chat?.id,user?.id]);
 useEffect(()=>{const el=textarea.current;if(el){el.style.height='0px';el.style.height=Math.min(el.scrollHeight,200)+'px'}},[draft]);
 useEffect(()=>{if(stick.current)scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'instant'})},[chat?.id,messages.length,messages.at(-1)?.content,messages.at(-1)?.state]);
 function fresh(){generation.current++;selected.current='';setWebSearch(!project?.files.length);setResearch(false);setTool('');chatUrl();setChat(null);setDraft('');attachments.reset();setError('');setLoading(false);setMobile(false);stick.current=true;setTimeout(()=>textarea.current?.focus(),0)}
 async function send(content=draft){
  if((!content.trim()&&!files.length)||attachments.waiting||attachments.failed||busy||pending||!user)return;
  const expected=user.id,version=generation.current;
  const current=()=>owner.current===expected&&version===generation.current;
  let id=selected.current;
  setBusy(true);setError('');
  try{
   const fileIds=files.map(item=>item.prepared!.id);
   if(!id){
    const value=await request('/chats','POST',projectId?{project:projectId}:{});
    if(!current())return;
    id=value.chat.id;selected.current=id;setTool('');chatUrl(id);setChat(value.chat);
   }
   const {chat:next}=await request('/chats/'+id+'/messages','POST',{
    content:content.trim()||'첨부한 자료의 핵심 내용과 근거를 요약해 줘.',model,effort,web_search:webSearch,attachments:fileIds,research,
   });
   if(current()&&selected.current===id){
    setChat(next);setDraft('');attachments.reset();stick.current=true;setJump(false);
   }
   if(owner.current===expected)await Promise.all([refreshList(),projectId?refreshProjects():undefined]);
  }catch(e){if(current())setError((e as Error).message)}
  finally{if(owner.current===expected)setBusy(false)}
 }
 function attach(incoming:FileList|File[]|null){
  try{
   attachments.attach(incoming,project?.files.length||0);
   if(incoming?.length){setWebSearch(false);setResearch(false);setError('')}
  }catch(error){setError((error as Error).message)}
 }
 async function previewFile(id:string,name:string){
  const expected=user?.id;
  setPreview({name,text:'',loading:true});
  try{
   const result=await request('/uploads/'+id+'/text');
   if(owner.current===expected)setPreview(current=>current?.name===name?{name,text:result.text,loading:false}:current);
  }catch(error){
   if(owner.current===expected)setPreview(current=>current?.name===name?{name,text:(error as Error).message,loading:false}:current);
  }
 }
 function switchProject(id:string){
  fresh();setProjectId(id);
  setWebSearch(!projects.find(item=>item.id===id)?.files.length);
 }
 async function createProject(){
  const expected=user?.id;
  setProjectBusy(true);
  try{
   const result=await request('/projects','POST',{title:projectTitle});
   if(owner.current!==expected)return;
   switchProject(result.project.id);setProjectDialog(false);setProjectTitle('');
   await refreshProjects();
  }catch(error){if(owner.current===expected)setError((error as Error).message)}
  finally{setProjectBusy(false)}
 }
 async function removeProjectFile(id:string){
  const expected=user?.id;
  if(!project||!await confirm({title:'프로젝트에서 파일을 뺄까요?',message:'이전 답변에 저장된 발췌문은 남아요.',confirmLabel:'제거'}))return;
  if(owner.current!==expected)return;
  try{await request('/projects/'+project.id+'/files/'+id,'DELETE');await refreshProjects()}
  catch(error){setError((error as Error).message)}
 }
 async function deleteProject(){
  const expected=user?.id;
  if(!project||!await confirm({title:'프로젝트를 삭제할까요?',message:'대화는 전체 대화에 남아요.',confirmLabel:'삭제'}))return;
  if(owner.current!==expected)return;
  try{
   await request('/projects/'+project.id,'DELETE');
   if(owner.current!==expected)return;
   switchProject('');await Promise.all([refreshList(),refreshProjects()]);
  }catch(error){if(owner.current===expected)setError((error as Error).message)}
 }
 async function remove(item:Summary){if(!await confirm({title:'이 대화를 삭제할까요?',message:'대화 기록과 연결된 AI 작업이 삭제돼요.',confirmLabel:'삭제'}))return;const expected=user?.id;try{await request('/chats/'+item.id,'DELETE');if(owner.current!==expected)return;if(selected.current===item.id)fresh();await refreshList()}catch(e){if(owner.current===expected)setError((e as Error).message)}}
 async function stop(){if(!pending||!chat)return;const id=chat.id,expected=user?.id;try{await request('/jobs/'+pending.job_id+'/cancel','POST',{});const value=await request('/chats/'+id);if(owner.current===expected&&selected.current===id)setChat(value.chat)}catch(e){if(owner.current===expected)setError((e as Error).message)}}
 const filtered=chats.filter(c=>(!projectId||c.project===projectId)&&c.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()/1000;
 const groups=[{label:'오늘',items:filtered.filter(c=>c.updated>=today)},{label:'최근 7일',items:filtered.filter(c=>c.updated<today&&c.updated>=today-6*86400)},{label:'이전 대화',items:filtered.filter(c=>c.updated<today-6*86400)}];
 useEffect(()=>{const viewport=window.visualViewport;const sync=()=>document.documentElement.style.setProperty('--chat-height',(viewport?.height||window.innerHeight)+'px');sync();viewport?.addEventListener('resize',sync);window.addEventListener('resize',sync);return()=>{viewport?.removeEventListener('resize',sync);window.removeEventListener('resize',sync);document.documentElement.style.removeProperty('--chat-height')}},[]);
 const history=<div className="chat-sidebar-inner"><div className="chat-brand"><Link href="/" aria-label="CBGPU 홈"><Image src="/img/cbgpu-logo.png" alt="" width={29} height={29}/><span>CBGPU<span>AI</span></span></Link><button className="chat-icon" aria-label="대화 목록 닫기" onClick={()=>{setMobile(false);setSidebar(false)}}><PanelLeft size={19}/></button></div><button className="chat-new" onClick={fresh}><PenLine size={18}/><span>새 대화</span><span className="chat-new-plus">＋</span></button><div className="chat-project-picker"><label>프로젝트<select value={projectId} onChange={event=>switchProject(event.target.value)}><option value="">전체 대화</option>{projects.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}</select></label><button type="button" disabled={!user||!isApproved} onClick={()=>{setMobile(false);setProjectDialog(true)}} aria-label="새 프로젝트">＋</button></div><nav className="chat-tools" aria-label="AI 기능">{toolItems.map(t=><button key={t.id} data-ai-tool={t.id} aria-pressed={tool===t.id} onClick={()=>chooseTool(t.id)}><t.icon size={16}/><span>{t.name}</span></button>)}</nav><label className="chat-history-search"><Search size={16}/><input aria-label="대화 검색" placeholder="대화 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="chat-history">{groups.map(group=>!!group.items.length&&<section key={group.label}><h2>{group.label}</h2>{group.items.map(item=><div className={`chat-history-row ${chat?.id===item.id?'selected':''}`} key={item.id}><button className="chat-history-open" onClick={()=>void openChat(item.id)} aria-current={chat?.id===item.id?'page':undefined}><MessageSquare size={15}/><span>{item.title}</span></button><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="chat-icon chat-row-menu" aria-label={item.title+' 대화 메뉴'}><MoreHorizontal size={17}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="chat-menu" sideOffset={4} align="end"><DropdownMenu.Item onSelect={()=>{setRename(item);setTitle(item.title)}}><PenLine size={15}/>이름 변경</DropdownMenu.Item><DropdownMenu.Item className="chat-delete" onSelect={()=>void remove(item)}><Trash2 size={15}/>삭제</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>)}</section>)}{!chats.length&&!loading&&<div className="chat-history-empty"><MessageSquare size={22}/><p>첫 대화를 시작해 보세요.</p><span>대화는 내 계정에 저장돼요.</span></div>}{chats.length>0&&!filtered.length&&<p className="chat-history-empty">일치하는 대화가 없어요.</p>}</div><div className="chat-sidebar-bottom"><Link href="/"><Home size={17}/><span>내 CBGPU로 돌아가기<small>학교생활 · 연구와 개발</small></span></Link><div className="chat-account"><span className="chat-avatar">{(user?.user_metadata?.full_name||user?.email||'C').slice(0,1)}</span><div><strong>{user?.user_metadata?.full_name||user?.email?.split('@')[0]||'CBGPU'}</strong><span>내 계정에 저장되는 대화</span></div><button className="chat-icon" aria-label="화면 테마 전환" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>{resolvedTheme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div></div></div>;
 if(!isLoading&&user&&!isApproved)return <div className="chat-frame"><main id="main-content" className="chat-main"><header className="chat-header"><Link href="/">CBGPU AI</Link></header><div className="chat-loading"><p>계정 승인 후 AI 대화를 이용할 수 있어요. <Link href="/profile" className="underline">내 계정 확인</Link></p></div></main></div>;
 return <div className={`chat-frame ${sidebar?'':'chat-sidebar-collapsed'}`}>
  <aside className="chat-desktop-sidebar" aria-label="대화 목록" inert={!sidebar}>{history}</aside>
  <Dialog.Root open={mobile} onOpenChange={setMobile}><Dialog.Portal><Dialog.Overlay className="chat-drawer-overlay"/><Dialog.Content className="chat-mobile-sidebar" aria-describedby={undefined}><Dialog.Title className="sr-only">대화 목록</Dialog.Title>{history}</Dialog.Content></Dialog.Portal></Dialog.Root>
  <main id="main-content" className="chat-main" tabIndex={-1}>
   <header className="chat-header"><div><button className="chat-icon chat-desktop-toggle" aria-label={sidebar?'대화 목록 접기':'대화 목록 열기'} onClick={()=>setSidebar(v=>!v)}><PanelLeft size={20}/></button><button className="chat-icon chat-mobile-toggle" aria-label="대화 목록 열기" onClick={()=>setMobile(true)}><PanelLeft size={20}/></button>{tool?<span className="chat-model">{toolItems.find(t=>t.id===tool)?.name}</span>:<DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="chat-model">{chatModels.find(m=>m.id===model)?.name||'CBGPU AI'}<ChevronDown size={16}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="chat-menu chat-model-menu" align="start" sideOffset={10}><p><strong>CBGPU 로컬 모델</strong><span>학교 유휴 GPU에서 실행해요.</span></p>{chatModels.map(m=><DropdownMenu.Item key={m.id} onSelect={()=>setModel(m.id)}><span className="w-4">{model===m.id&&<Check size={16}/>}</span><span>{m.name}<small>{m.description}</small></span></DropdownMenu.Item>)}<DropdownMenu.Item onSelect={()=>chooseTool('cli')}><Code2 size={16}/>터미널 코딩 에이전트</DropdownMenu.Item><DropdownMenu.Item onSelect={()=>chooseTool('api')}><KeyRound size={16}/>API 키 · 모델</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}</div><div><span className="chat-private"><span/>개인 대화</span><Link className="chat-icon" href="/" aria-label="CBGPU 홈"><Home size={18}/></Link><button className="chat-icon" aria-label="새 대화" onClick={fresh}><PenLine size={19}/></button></div></header>
   {tool?<div className="chat-tool-scroll">{tool==='cli'?<CliGuide/>:tool==='robotics'?<RoboticsGuide key={user?.id||'guest'}/>:<AiToolsPanel key={tool} initialTab={tool} onUsePrompt={async text=>{if(draft&&!await confirm({title:'입력을 바꿀까요?',message:'작성 중인 입력을 최적화 결과로 바꿔요.',confirmLabel:'바꾸기'}))return;chooseTool('');setDraft(text);setTimeout(()=>textarea.current?.focus(),0)}}/>}</div>:<><div className="chat-scroll" ref={scroll} onScroll={()=>{const el=scroll.current;if(el){stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;setJump(!stick.current)}}}>
    {loading||isLoading?<div className="chat-loading" role="status"><Loader2 className="animate-spin" size={22}/>대화 불러오는 중…</div>:!messages.length?<div className="chat-welcome"><div className="chat-welcome-brand"><Image src="/img/cbgpu-logo.png" alt="" width={46} height={46}/><span>YOUR EVERYDAY COPILOT</span></div><h1>무엇을 도와드릴까요?</h1><p>작은 궁금증부터 다음 연구 아이디어까지.<br className="chat-mobile-break"/> CBGPU와 함께 풀어보세요.</p><div className="chat-suggestions">{suggestions.map(s=><button key={s.title} onClick={()=>{setDraft(s.prompt);textarea.current?.focus()}}><s.icon size={21}/><span>{s.title}</span></button>)}</div></div>:<div className="chat-thread" aria-label="대화 내용">{messages.map((message,index)=><article key={message.id} className={'chat-message chat-message-'+message.role} aria-label={message.role==='user'?'내 메시지':'CBGPU AI 답변'}>{message.role==='assistant'&&<div className="chat-assistant-logo"><Image src="/img/cbgpu-logo.png" alt="CBGPU AI" width={24} height={24}/></div>}<div className="chat-message-body">{message.content?message.role==='assistant'?<Answer text={message.content}/>:<p className="chat-user-text">{message.content}</p>:live(message)?<div className="chat-thinking" role="status"><span className="chat-thinking-dot"/>{message.state==='paused'?'예약된 GPU에 양보했어요. 사용 가능한 GPU를 기다려요.':message.state==='queued'?'답변을 준비하고 있어요…':'생각하고 있어요…'}</div>:<p className="chat-message-error">{message.error||'답변 생성이 중단됐어요.'}</p>}<MessageSources sources={message.sources||[]}/>{message.content&&['failed','cancelled'].includes(message.state)&&<p className="chat-context-note">생성이 중단되어 이 답변은 미완성 상태예요.</p>}{message.truncated&&<p className="chat-context-note">답변 길이 한도에 도달했어요. 이어서 설명해 달라고 요청할 수 있어요.</p>}{message.content&&<div className="chat-message-actions"><CopyButton text={message.content} label={message.role==='assistant'?'답변 복사':'질문 복사'}/>{message.role==='assistant'&&!live(message)&&<button className="chat-icon" aria-label="답변 다운로드" title="Markdown 다운로드" onClick={()=>saveAiBlob(message.content,'cbgpu-answer.md')}><Download size={15}/></button>}{message.role==='user'&&<button className="chat-icon" aria-label="질문 다시 사용" onClick={()=>{setDraft(message.content);textarea.current?.focus()}}><PenLine size={14}/></button>}</div>}{message.role==='assistant'&&!live(message)&&!message.content&&index===messages.length-1&&<button className="chat-retry" disabled={busy} onClick={()=>void send(messages[index-1]?.content)}>다시 질문하기</button>}</div></article>)}</div>}
   </div>
   <div className="chat-composer-area">{jump&&<button className="chat-jump chat-icon" aria-label="최근 메시지로 이동" onClick={()=>{stick.current=true;scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})}}><ArrowDown size={18}/></button>}<div className="chat-composer-wrap">{error&&<div className="chat-error" role="alert"><span>{error}</span><button className="chat-icon" aria-label="오류 닫기" onClick={()=>setError('')}><X size={15}/></button></div>}{project&&<div className="chat-project-files"><strong>{project.title}</strong><button type="button" className="chat-icon" disabled={busy||!!pending} aria-label="프로젝트 삭제" onClick={()=>void deleteProject()}><Trash2 size={14}/></button>{project.files.map(file=><span key={file.id}><FileText size={14}/><span title={file.name}>{file.name}</span><button type="button" className="chat-icon" disabled={busy||!!pending} aria-label={file.name+' 프로젝트에서 제거'} onClick={()=>void removeProjectFile(file.id)}><X size={14}/></button></span>)}</div>}{chat?.context_truncated&&<p className="chat-context-note">대화가 길어 최근 메시지를 중심으로 답변해요.</p>}<form className="chat-composer" onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault()}} onDrop={event=>{event.preventDefault();if(!busy&&!pending&&user&&isApproved)attach(event.dataTransfer.files)}} onPaste={event=>{if(event.clipboardData.files.length&&!busy&&!pending&&user&&isApproved){event.preventDefault();attach(event.clipboardData.files)}}} onSubmit={e=>{e.preventDefault();void send()}}>{!!files.length&&<div className="chat-attachments" aria-label="첨부 파일">{files.map(item=><div className={'chat-file-card '+item.status} key={item.key}>
 {item.status==='uploading'||item.status==='processing'?<Loader2 className="animate-spin" size={18}/>:item.status==='ready'?<Check size={18}/>:<FileText size={18}/>}
 <div><strong title={item.file.name}>{item.file.name}</strong><span role={item.status==='failed'?'alert':'status'}>{item.status==='uploading'?'업로드 중…':item.status==='processing'?item.prepared?.pages?`문서 읽는 중 · ${item.prepared.progress||0}/${item.prepared.pages}쪽`:'문서 읽는 중 · 스캔은 자동 OCR':item.status==='failed'?item.error:item.prepared?.ocr_pages?`준비 완료 · ${item.prepared.ocr_pages}쪽 OCR`:'준비 완료'}</span>
 {!!item.prepared?.weak_pages?.length&&<small>글자가 흐린 페이지가 있어요. 답변의 인식 결과를 확인해 주세요.</small>}
 {item.prepared?.truncated&&<small>문서가 길어 일부 텍스트만 읽었어요.</small>}
 </div>
 {item.status==='ready'&&<button type="button" className="chat-file-retry" onClick={()=>void previewFile(item.prepared!.id,item.file.name)}>내용 확인</button>}
 {item.status==='failed'&&<button type="button" className="chat-file-retry" onClick={()=>attachments.retry(item)}>재시도</button>}
 <button className="chat-icon" type="button" disabled={busy} aria-label={item.file.name+' 제거'} onClick={()=>attachments.remove(item.key)}><X size={15}/></button>
 </div>)}</div>}<textarea data-no-focus-ring ref={textarea} aria-label="메시지 입력" placeholder={files.length?'이 자료에 대해 무엇이 궁금한가요?':'CBGPU에게 무엇이든 물어보세요'} rows={1} maxLength={8000} value={draft} disabled={!user||!isApproved||loading} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&window.matchMedia('(pointer: fine)').matches){e.preventDefault();if(!pending)void send()}}}/><div className="chat-composer-toolbar"><div className="chat-composer-options"><input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.csv,.txt,.md,.json,.tex,.py,.log" hidden multiple onChange={e=>{attach(e.target.files);e.target.value=''}}/><button type="button" className="chat-icon" aria-label="파일 첨부" title="파일 첨부" disabled={busy||!!pending||!user||!isApproved||loading} onClick={()=>fileInput.current?.click()}><Paperclip size={17}/></button><DropdownMenu.Root><DropdownMenu.Trigger asChild><button type="button" className="chat-web-toggle" aria-label="웹 검색 설정" aria-pressed={webSearch||research} title="검색을 켜면 질문을 검색엔진에 전송해요"><Globe size={14}/>{research?'출처 비교':webSearch?'웹 검색 켜짐':'웹 검색 꺼짐'}<ChevronDown size={12}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="chat-menu" side="top" align="start" sideOffset={6}><DropdownMenu.RadioGroup value={research?'research':webSearch?'search':'off'} onValueChange={value=>{setResearch(value==='research');setWebSearch(value!=='off')}}><DropdownMenu.RadioItem value="off">검색 끄기</DropdownMenu.RadioItem><DropdownMenu.RadioItem value="search">웹 검색</DropdownMenu.RadioItem><DropdownMenu.RadioItem value="research">여러 출처 비교</DropdownMenu.RadioItem></DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root><EffortControl value={effort} onChange={setEffort}/></div>{pending?<button className="chat-send chat-stop" type="button" aria-label="답변 생성 중지" onClick={()=>void stop()}><Square size={15} fill="currentColor"/></button>:<button className="chat-send" type="submit" aria-label="메시지 보내기" disabled={busy||attachments.waiting||attachments.failed||(!draft.trim()&&!files.length)||!user||!isApproved||loading}>{busy?<Loader2 size={19} className="animate-spin"/>:<ArrowUp size={21}/>}</button>}</div></form><p className="chat-disclaimer">AI 답변은 부정확할 수 있어요. 중요한 내용은 확인해 주세요.</p></div></div>
   </>}
  </main>
  <Dialog.Root open={!!preview} onOpenChange={open=>{if(!open)setPreview(null)}}><Dialog.Portal><Dialog.Overlay className="chat-drawer-overlay"/><Dialog.Content className="chat-file-preview" aria-describedby={undefined}><header><div><Dialog.Title>{preview?.name}</Dialog.Title><p>AI가 참고할 텍스트</p></div><Dialog.Close className="chat-icon" aria-label="파일 내용 닫기"><X size={19}/></Dialog.Close></header><div className="chat-file-preview-body">{preview?.loading?<p role="status"><Loader2 className="animate-spin" size={18}/>내용을 불러오는 중…</p>:<pre>{preview?.text}</pre>}</div><footer><button type="button" disabled={preview?.loading} onClick={()=>preview&&saveAiBlob(preview.text,preview.name+'.txt')}>텍스트 저장</button><Dialog.Close>닫기</Dialog.Close></footer></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={projectDialog} onOpenChange={setProjectDialog}><Dialog.Portal><Dialog.Overlay className="chat-drawer-overlay"/><Dialog.Content className="chat-rename-dialog" aria-describedby={undefined}><Dialog.Title>새 프로젝트</Dialog.Title><form onSubmit={event=>{event.preventDefault();void createProject()}}><input aria-label="프로젝트 이름" value={projectTitle} onChange={event=>setProjectTitle(event.target.value)} maxLength={80} required autoFocus/><div><Dialog.Close className="chat-dialog-cancel">취소</Dialog.Close><button className="chat-dialog-save" disabled={projectBusy||!projectTitle.trim()}>만들기</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={!!rename} onOpenChange={open=>{if(!open)setRename(null)}}><Dialog.Portal><Dialog.Overlay className="chat-drawer-overlay"/><Dialog.Content className="chat-rename-dialog" aria-describedby={undefined}><Dialog.Title>대화 이름 변경</Dialog.Title><form onSubmit={e=>{e.preventDefault();if(!rename)return;const expected=user?.id;void request('/chats/'+rename.id,'POST',{title}).then(async value=>{if(owner.current!==expected)return;if(selected.current===rename.id)setChat(value.chat);setRename(null);await refreshList()}).catch(e=>setError(e.message))}}><input aria-label="대화 제목" value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} required autoFocus/><div><Dialog.Close className="chat-dialog-cancel">취소</Dialog.Close><button className="chat-dialog-save" disabled={!title.trim()}>저장</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>
 </div>;
}
