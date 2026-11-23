'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { Plus, Trash2, ArrowLeft, Share2, Lock, Save, Tag, X, Check, Sparkles } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import { requestAi } from '@/lib/requestAi';
import InlineAi from '@/components/ai/InlineAi';
import {boundedClientRequest} from '@/lib/boundedClientRequest';
import {createNotePersistence,createSerializedWriter,NoteConflict,type NoteDraft,type ResearchNote} from '@/lib/notePersistence';

import {noteRecoveryStorage,readNoteRecovery,writeNoteRecovery,clearNoteRecovery,type NoteRecovery} from '@/lib/noteDraftRecovery';

// ─── types ────────────────────────────────────────────────────────────────────
type Note=ResearchNote;

// ─── Simple markdown renderer (no external lib) ───────────────────────────────
function renderMd(raw: string): string {
  const lines = raw.split('\n');
  let html = ''; let inCode = false; let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { inCode = !inCode; html += inCode ? '<pre class="bg-muted rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono"><code>' : '</code></pre>'; continue; }
    if (inCode) { html += escHtml(l) + '\n'; continue; }
    if (inList && !l.startsWith('- ') && !l.match(/^\d+\. /)) { html += '</ul>'; inList = false; }
    if (l.startsWith('### ')) { html += `<h3 class="text-lg font-semibold mt-5 mb-1">${inlineMd(l.slice(4))}</h3>`; }
    else if (l.startsWith('## '))  { html += `<h2 class="text-xl font-semibold mt-6 mb-2">${inlineMd(l.slice(3))}</h2>`; }
    else if (l.startsWith('# '))   { html += `<h1 class="text-2xl font-semibold mt-8 mb-3">${inlineMd(l.slice(2))}</h1>`; }
    else if (l.startsWith('> '))   { html += `<blockquote class="border-l-4 border-primary/40 pl-4 my-2 text-muted-foreground ">${inlineMd(l.slice(2))}</blockquote>`; }
    else if (l.startsWith('---'))  { html += '<hr class="border-border/40 my-4" />'; }
    else if (l.startsWith('- '))   { if (!inList) { html += '<ul class="list-disc ml-5 my-2 space-y-0.5">'; inList = true; } html += `<li class="text-sm leading-relaxed">${inlineMd(l.slice(2))}</li>`; }
    else if (l.match(/^\d+\. /))   { if (!inList) { html += '<ol class="list-decimal ml-5 my-2 space-y-0.5">'; inList = true; } html += `<li class="text-sm leading-relaxed">${inlineMd(l.replace(/^\d+\. /, ''))}</li>`; }
    else if (l.trim() === '')      { html += '<br />'; }
    else                           { html += `<p class="text-sm leading-relaxed my-1">${inlineMd(l)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}
function escHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
/** 마크다운 치환 전에 반드시 이스케이프부터 한다 — 순서를 바꾸면 사용자 입력의 &lt;script&gt; 등이 그대로 렌더링되는 저장형 XSS가 된다 */
function inlineMd(s: string) {
  return escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
}

// ─── NoteEditor ───────────────────────────────────────────────────────────────
function NoteEditor({ note, recovery, onBack, onSaved }: { note: Note | null; recovery?:NoteRecovery; onBack: () => void; onSaved: (n: Note) => void }) {
  const { user } = useAuth();
  const frame=useRef<HTMLDivElement>(null);
  const [frameHeight,setFrameHeight]=useState('calc(100dvh - 220px)');
  useEffect(()=>{
    const fit=()=>{if(!frame.current)return;const viewport=window.visualViewport;const bottom=(viewport?.height??innerHeight)+(viewport?.offsetTop??0);const nav=document.querySelector('.cb-bottom-nav');const rect=nav?.getBoundingClientRect();const limit=rect&&rect.height>0&&rect.top>0?Math.min(bottom,rect.top):bottom;setFrameHeight(`${Math.max(120,limit-frame.current.getBoundingClientRect().top-12)}px`)};
    fit();const observer=new ResizeObserver(fit);for(const element of document.querySelectorAll('header,.cb-bottom-nav'))observer.observe(element);window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
    return()=>{observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit)};
  },[]);
  const { showError, confirm } = useAlert();
  const isOwner = !note || note.user_id === user?.id;
  const [owner] = useState(()=>user!.id);
  const [id] = useState(()=>recovery?.id??note?.id??crypto.randomUUID());
  const initial=recovery?.draft??{title:note?.title??'',content:note?.content??'',tags:note?.tags??[],is_shared:note?.is_shared??false};
  const base=useRef<Note|null>(recovery?.base??note);
  const attempted=useRef<NoteDraft|undefined>(recovery?.attempted);
  const [draft,setDraft]=useState<NoteDraft>(initial);
  const latest=useRef<NoteDraft>(initial),revision=useRef(recovery?1:0),acknowledged=useRef(0),alive=useRef(true),paused=useRef(!!recovery),pendingSaves=useRef(0);
  const {title,content,tags,is_shared:shared}=draft;
  const [tagInput, setTagInput] = useState('');
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'>('idle');
  const [saveError,setSaveError]=useState('');
  const [suggestedTags,setSuggestedTags]=useState<string[]>([]);
  const [suggestingTags,setSuggestingTags]=useState(false);
  const lastTagRequestRef=useRef('');
  const [view,setView]=useState<'edit'|'preview'>('edit');
  const autoRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const savedCallback=useRef(onSaved);
  useEffect(()=>{savedCallback.current=onSaved},[onSaved]);
  const writerRef=useRef<ReturnType<typeof createSerializedWriter<{draft:NoteDraft;revision:number},{note:Note;revision:number}>>|null>(null);
  const getWriter=useCallback(()=>{
    if(writerRef.current)return writerRef.current;
    const guard=async(signal:AbortSignal)=>{
      const session=(await supabase.auth.getSession()).data.session;
      if(signal.aborted||!alive.current||session?.user.id!==owner)throw Error('로그인한 계정이 바뀌었어요.');
    };
    const fields='id,user_id,title,content,tags,is_shared,created_at,updated_at';
    const persistence=createNotePersistence({id,owner,initial:recovery?.base??note,recoveredDraft:recovery?.attempted??recovery?.draft,
      read:()=>boundedClientRequest(async signal=>{await guard(signal);const {data,error}=await supabase.from('research_notes').select(fields).eq('id',id).eq('user_id',owner).abortSignal(signal).maybeSingle();if(error)throw error;return data as Note|null}),
      create:value=>boundedClientRequest(async signal=>{await guard(signal);const {data,error}=await supabase.from('research_notes').insert({...value,id,user_id:owner,updated_at:new Date().toISOString()}).select(fields).abortSignal(signal).single();if(error)throw error;return data as Note},undefined,30000),
      update:(value,version)=>boundedClientRequest(async signal=>{await guard(signal);const stamp=new Date(Math.max(Date.now(),Date.parse(version)+1)).toISOString();const {data,error}=await supabase.from('research_notes').update({...value,updated_at:stamp}).eq('id',id).eq('user_id',owner).eq('updated_at',version).select(fields).abortSignal(signal).maybeSingle();if(error)throw error;return data as Note|null},undefined,30000),
    });
    writerRef.current=createSerializedWriter(async(value:{draft:NoteDraft;revision:number})=>{attempted.current=value.draft;writeNoteRecovery(noteRecoveryStorage(),{id,owner,base:base.current,draft:latest.current,attempted:value.draft});return{note:await persistence(value.draft),revision:value.revision}});
    return writerRef.current;
  },[id,owner,note,recovery]);
  useEffect(()=>{
    alive.current=true;
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(revision.current>acknowledged.current){event.preventDefault();event.returnValue=''}};
    window.addEventListener('beforeunload',beforeUnload);
    return()=>{alive.current=false;if(autoRef.current)clearTimeout(autoRef.current);writerRef.current?.cancelPending();window.removeEventListener('beforeunload',beforeUnload)};
  },[]);
  const saveCurrent=useCallback(async()=>{
    if(!alive.current||paused.current||!isOwner)return false;
    if(revision.current===acknowledged.current)return true;
    const version=revision.current;
    pendingSaves.current++;setSaveState('saving');setSaveError('');
    try{
      const result=await getWriter().save({draft:{...latest.current,tags:[...latest.current.tags]},revision:version});
      if(!alive.current)return false;
      base.current=result.note;
      acknowledged.current=Math.max(acknowledged.current,result.revision);
      if(revision.current===acknowledged.current)clearNoteRecovery(noteRecoveryStorage(),owner,id);
      else writeNoteRecovery(noteRecoveryStorage(),{id,owner,base:result.note,draft:latest.current,attempted:attempted.current});
      savedCallback.current(result.note);return true;
    }catch(error){
      if(alive.current){paused.current=true;if(autoRef.current)clearTimeout(autoRef.current);setSaveError(error instanceof NoteConflict?error.message:'저장 결과를 확인하지 못했어요. 입력 내용은 그대로예요. 저장을 다시 누르면 기존 기록부터 확인해요.');}
      return false;
    }finally{pendingSaves.current--;if(alive.current)setSaveState(pendingSaves.current?'saving':revision.current===acknowledged.current?'saved':'idle')}
  },[getWriter,isOwner,owner,id]);
  const scheduleAutoSave=()=>{
    if(autoRef.current)clearTimeout(autoRef.current);
    if(!paused.current)autoRef.current=setTimeout(()=>{autoRef.current=null;void saveCurrent()},2000);
  };
  const change=(patch:Partial<NoteDraft>)=>{latest.current={...latest.current,...patch};revision.current++;if(!writeNoteRecovery(noteRecoveryStorage(),{id,owner,base:base.current,draft:latest.current,attempted:attempted.current}))setSaveError('브라우저가 임시 보관을 차단했어요. 저장을 확인하기 전에는 이 탭을 닫거나 새로고침하지 마세요.');setDraft(latest.current);setSaveState('idle');scheduleAutoSave()};
  const setTitle=(value:string)=>change({title:value});
  const setContent=(value:string|((previous:string)=>string))=>change({content:typeof value==='function'?value(latest.current.content):value});
  const setTags=(value:string[])=>change({tags:value});
  const setShared=(value:boolean)=>change({is_shared:value});
  const saveNow=(t=latest.current.title,c=latest.current.content,tg=latest.current.tags,sh=latest.current.is_shared)=>{
    if(autoRef.current){clearTimeout(autoRef.current);autoRef.current=null}
    latest.current={title:t,content:c,tags:[...tg],is_shared:sh};if(!note&&revision.current===0)revision.current++;paused.current=false;return saveCurrent();
  };
  const leave=async()=>{
    if(!isOwner||revision.current===acknowledged.current){if(alive.current)onBack();return}
    if(await saveNow()){if(alive.current&&revision.current===acknowledged.current)onBack();return}
    if(await confirm({title:'아직 저장되지 않은 내용이 있어요',message:'입력 내용을 복사해 보관할 수 있어요. 저장하지 않고 목록으로 돌아갈까요?',confirmLabel:'저장하지 않고 나가기',cancelLabel:'계속 편집'})){if(alive.current){clearNoteRecovery(noteRecoveryStorage(),owner,id);onBack()}}
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { const next = [...tags, t]; setTags(next); }
    setTagInput('');
  };

  const suggestTags = async () => {
    const signature = `${title}\n${content}`.slice(0, 500);
    if (content.trim().length < 80 || suggestingTags || signature === lastTagRequestRef.current) return;
    lastTagRequestRef.current = signature;
    setSuggestingTags(true);
    try {
      const result = await requestAi('tags', `${title}\n${content.slice(0, 1200)}`,{userId:user?.id});
      setSuggestedTags(result.split(/[,，\n]+/).map(tag => tag.replace(/^[#\s\d.\-]+/, '').trim()).filter(tag => tag.length > 1 && tag.length <= 20 && !tags.includes(tag)).slice(0, 3));
    } catch {
      // Suggestions are optional; never interrupt editing or saving.
    } finally {
      setSuggestingTags(false);
    }
  };

  // toolbar shortcuts
  const wrap = (before: string, after = before) => {
    const ta = document.getElementById('note-content') as HTMLTextAreaElement;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
    const next = val.slice(0, s) + before + val.slice(s, e) + after + val.slice(e);
    setContent(next);
    setTimeout(() => { ta.selectionStart = s + before.length; ta.selectionEnd = e + before.length; ta.focus(); }, 0);
  };

  const TOOLBAR = [
    { label: 'H1', action: () => { const ta = document.getElementById('note-content') as HTMLTextAreaElement; const pos = ta?.value.lastIndexOf('\n', ta.selectionStart-1)+1; setContent(c => c.slice(0,pos)+'# '+c.slice(pos)); }},
    { label: 'H2', action: () => { const ta = document.getElementById('note-content') as HTMLTextAreaElement; const pos = ta?.value.lastIndexOf('\n', ta.selectionStart-1)+1; setContent(c => c.slice(0,pos)+'## '+c.slice(pos)); }},
    { label: 'B',  action: () => wrap('**') },
    { label: 'I',  action: () => wrap('*') },
    { label: '`',  action: () => wrap('`') },
    { label: '```',action: () => wrap('```\n', '\n```') },
    { label: '>',  action: () => { const ta = document.getElementById('note-content') as HTMLTextAreaElement; const pos = ta?.value.lastIndexOf('\n', ta.selectionStart-1)+1; setContent(c => c.slice(0,pos)+'> '+c.slice(pos)); }},
    { label: '—',  action: () => setContent(c => c + '\n---\n') },
  ];

  // 다른 사람이 공유한 노트는 읽기만 가능 — DB RLS도 실제 수정을 막지만,
  // 편집 UI를 그대로 보여주면 한참 고치고 저장할 때야 에러를 보게 돼서 미리 분기한다.
  if (!isOwner) {
    return (
      <div ref={frame} className="flex min-h-0 flex-col overflow-y-auto" style={{height:frameHeight}}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
          <Button variant="ghost" size="icon" aria-label="노트 목록으로 돌아가기" onClick={()=>void leave()} className="active:scale-90 transition-transform"><ArrowLeft className="size-4" /></Button>
          <h1 className="flex-1 font-semibold text-base truncate px-2">{title || '제목 없음'}</h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground bg-muted shrink-0">
            <Share2 className="size-3" />공개 노트
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4"
          dangerouslySetInnerHTML={{ __html: renderMd(content) || '<p class="text-muted-foreground text-sm">아직 작성한 내용이 없어요.</p>' }} />
        {tags.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/20 flex-shrink-0 flex-wrap">
            <Tag className="size-3 text-muted-foreground shrink-0" />
            {tags.map(t => <span key={t} className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={frame} className="flex min-h-0 flex-col overflow-y-auto" style={{height:frameHeight}}>
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0 flex-wrap gap-y-2">
        <Button variant="ghost" size="icon" aria-label="노트 목록으로 돌아가기" onClick={()=>void leave()} className="active:scale-90 transition-transform"><ArrowLeft className="size-4" /></Button>
        <Input value={title} onChange={e => { setTitle(e.target.value); }}
          placeholder="제목 없음" className="flex-1 min-w-32 font-semibold text-base border-none shadow-none focus-visible:ring-0 px-2" />
        <div className="flex gap-1 items-center ml-auto flex-wrap">
          <button onClick={() => { const n = !shared; setShared(n); saveNow(title, content, tags, n); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${shared?'text-primary bg-primary/10':'text-muted-foreground bg-muted'}`}>
            {shared ? <Share2 className="size-3" /> : <Lock className="size-3" />}
            {shared ? '공개' : '비공개'}
          </button>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(['edit','preview'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all active:scale-95 ${view===v?'bg-background shadow text-foreground':'text-muted-foreground'}`}>
                {v === 'edit' ? '편집' : '미리보기'}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => saveNow()}
            disabled={saveState === 'saving'}
            className={`font-semibold text-xs gap-1.5 transition-all active:scale-95 ${saveState === 'saved' ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}`}
          >
            {saveState === 'saving' ? (
              <>저장 중…</>
            ) : saveState === 'saved' ? (
              <span key="saved" className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                <Check className="size-3" />저장됨
              </span>
            ) : (
              <>
                <Save className="size-3" />저장
              </>
            )}
          </Button>
        </div>
      </div>

      {saveError&&<div role="alert" className="mx-4 my-2 shrink-0 rounded-lg border border-destructive/30 p-3 text-sm"><p>{saveError}</p><Button variant="outline" className="mt-2" onClick={()=>void navigator.clipboard.writeText(title+'\n\n'+content).catch(()=>showError('복사하지 못했어요. 내용을 직접 선택해 보관해 주세요.'))}>입력 내용 복사</Button></div>}
      <details className="mx-4 shrink-0"><summary className="min-h-11 cursor-pointer text-sm font-medium text-primary">AI로 요약·문장 다듬기</summary><div className="max-h-[45dvh] overflow-auto"><InlineAi input={title+'\n'+content} label="이 연구노트 살펴보기" actions={isOwner?['summary','improve','explain']:['summary','explain']} onApply={isOwner?text=>setContent(text):undefined}/></div></details>
      {/* toolbar */}
      {view === 'edit' && (
        <div className="flex gap-1 px-4 py-1.5 border-b border-border/20 overflow-x-auto flex-shrink-0">
          {['H1','H2','B','I','`','```','>','—'].map((label,index) => (
            <button key={label} onClick={()=>TOOLBAR[index].action()}
              className="px-2 py-1 rounded text-xs font-semibold text-muted-foreground hover:bg-muted transition-all font-mono shrink-0">{label}</button>
          ))}
        </div>
      )}

      {/* editor / preview */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'edit' ? (
          <textarea id="note-content" value={content}
            onChange={e => { setContent(e.target.value); }}
            onBlur={suggestTags}
            placeholder={'# 연구 노트 제목\n\n내용을 입력하세요...\n\n## 마크다운 문법 지원\n- **굵게**, *기울임*, `코드`\n- # H1, ## H2, ### H3\n- > 인용, --- 구분선\n- ``` 코드 블록 ```'}
            className="flex-1 w-full resize-none px-6 py-4 text-sm font-mono bg-background outline-none leading-relaxed animate-in fade-in duration-200"
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 animate-in fade-in duration-200"
            dangerouslySetInnerHTML={{ __html: renderMd(content) || '<p class="text-muted-foreground text-sm">아직 작성한 내용이 없어요.</p>' }} />
        )}
      </div>

      {/* tags */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border/20 flex-shrink-0 flex-wrap">
        <Tag className="size-3 text-muted-foreground shrink-0" />
        {tags.map(t => (
          <span key={t} className="flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full animate-in fade-in zoom-in-95 duration-200">
            {t}<button onClick={() => { const n=tags.filter(x=>x!==t); setTags(n); saveNow(title,content,n,shared); }} className="active:scale-90 transition-transform"><X className="size-2.5" /></button>
          </span>
        ))}
        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())}
          placeholder="태그 추가 (Enter)" className="text-xs bg-transparent outline-none font-medium text-muted-foreground placeholder:text-muted-foreground/40 w-24" />
        {(suggestingTags || suggestedTags.length > 0) && <span className="flex basis-full flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Sparkles className="size-3 text-primary" />{suggestingTags ? '태그를 찾는 중…' : '추천 태그'}
          {suggestedTags.filter(tag => !tags.includes(tag)).map(tag => <button key={tag} type="button" onClick={() => { const next = [...tags, tag]; setTags(next); setSuggestedTags(current => current.filter(item => item !== tag)); saveNow(title, content, next, shared); }} className="rounded-full border border-primary/30 px-2 py-1 font-bold text-primary hover:bg-primary/10">+ {tag}</button>)}
          {!suggestingTags && <span>· AI 제안은 눌렀을 때만 저장돼요</span>}
        </span>}
        {content.trim().length >= 80 && <span className="basis-full text-xs text-muted-foreground">편집을 마치면 CBGPU 로컬 AI가 태그를 추천해요. 원문을 외부 AI에 보내지 않아요.</span>}
      </div>
    </div>
  );
}

// ─── NoteList ─────────────────────────────────────────────────────────────────
function NoteList({ onOpen }: { onOpen: (n: Note | null) => void }) {
  const { user } = useAuth();
  const { showSuccess,showError } = useAlert();
  const [notes,  setNotes]  = useState<Note[]>([]);
  const [shared, setShared] = useState<Note[]>([]);
  const [tab,    setTab]    = useState<'mine'|'shared'>('mine');
  const [search, setSearch] = useState('');
  const [loadingTabs,setLoadingTabs]=useState({mine:true,shared:true});
  const loading=loadingTabs[tab];
  const [errors,setErrors]=useState({mine:'',shared:''});
  const requestRef=useRef<AbortController|null>(null),deleting=useRef(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const owner=user?.id;
  const load=useCallback(async()=>{
    requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;
    if(!owner){setLoadingTabs({mine:false,shared:false});return}
    setLoadingTabs({mine:true,shared:true});setErrors({mine:'',shared:''});
    const read=async(kind:'mine'|'shared')=>{
      try{
        const{data,error}=await boundedClientRequest(signal=>{
          const query=supabase.from('research_notes').select('*');
          return(kind==='mine'?query.eq('user_id',owner):query.eq('is_shared',true).neq('user_id',owner)).order('updated_at',{ascending:false}).limit(500).abortSignal(signal);
        },controller.signal);
        if(requestRef.current!==controller||controller.signal.aborted)return;
        if(error){if(error.code==='42P01'){setDbMissing(true);return}throw error}
        const rows=(data??[])as Note[];(kind==='mine'?setNotes:setShared)(rows);
      }catch{if(requestRef.current===controller&&!controller.signal.aborted)setErrors(previous=>({...previous,[kind]:'노트 목록을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'}))}
      finally{if(requestRef.current===controller&&!controller.signal.aborted)setLoadingTabs(previous=>({...previous,[kind]:false}))}
    };
    await Promise.all([read('mine'),read('shared')]);
  },[owner]);
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void load()});return()=>{active=false;requestRef.current?.abort();requestRef.current=null}},[load]);
  useEffect(()=>{if(loading)return;const id=new URLSearchParams(window.location.search).get('note');const found=[...notes,...shared].find(n=>n.id===id);if(found){onOpen(found);window.history.replaceState(null,'',window.location.pathname)}},[loading,notes,shared,onOpen]);
  const deleteNote=async(id:string)=>{
    if(deleting.current||!owner)return;deleting.current=true;
    try{
      const result=await boundedClientRequest(async signal=>{
        const session=(await supabase.auth.getSession()).data.session;
        if(!requestRef.current||signal.aborted||session?.user.id!==owner)throw Error('Account changed');
        return supabase.from('research_notes').delete().eq('id',id).eq('user_id',owner).select('id').abortSignal(signal);
      },undefined,30000);
      if(!requestRef.current)return;
      if(result.error||result.data?.length!==1||result.data[0].id!==id)throw Error('Deletion not confirmed');
      setNotes(n=>n.filter(x=>x.id!==id));showSuccess('노트를 삭제했어요.');
    }catch{if(requestRef.current)showError('삭제 결과를 확인하지 못했어요. 목록을 다시 불러와 확인해 주세요.');}
    finally{deleting.current=false}
  };

  if (dbMissing) return (
    <div className="py-16 flex flex-col items-center gap-4 text-center">
      <p className="text-4xl">⚠️</p>
      <p className="font-semibold text-lg tracking-tight">노트 저장소를 확인하지 못했어요</p>
      <p className="text-sm text-muted-foreground">잠시 후 다시 시도하거나 관리자에게 연결 상태 확인을 요청해 주세요.</p>
    </div>
  );

  const shown = (tab === 'mine' ? notes : shared)
    .filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.tags.some(t => t.includes(search)));

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!confirmDeleteId}
        onConfirm={() => { if(confirmDeleteId)void deleteNote(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SegmentedTabs
          items={[
            { value: 'mine', label: `내 노트 (${notes.length})` },
            { value: 'shared', label: `공유됨 (${shared.length})` },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'mine' | 'shared')}
        />
        <div className="flex gap-2">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..." className="h-8 w-32 md:text-xs" />
          {tab === 'mine' && <Button onClick={() => onOpen(null)} size="sm" className="font-semibold text-xs gap-1.5 h-8 active:scale-95 transition-transform"><Plus className="size-3" />새 노트</Button>}
        </div>
      </div>

      {errors[tab]&&<div role="alert" className="rounded-lg border border-border p-4 text-sm"><p>{errors[tab]}</p><Button variant="outline" className="mt-2" disabled={loading} onClick={()=>void load()}>목록 다시 불러오기</Button></div>}
      {loading ? <div className="py-16 flex items-center justify-center"><LoadingSpinner size={56} label="노트 불러오는 중" /></div>
      : shown.length === 0 && !errors[tab] ? (
        <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-2xl animate-in fade-in duration-300 pop-in-3d">
          <p style={{ fontFamily: 'Tossface', fontSize: 64, lineHeight: 1 }} className="mb-3">📓</p>
          <p className="font-medium">{tab==='mine'?'노트를 만들어 보세요.':'아직 공유된 노트가 없어요.'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {shown.map((n, i) => (
            <div key={n.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="relative p-4 border border-border/50 rounded-2xl bg-card hover:bg-muted/20 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 tilt-3d cursor-pointer transition-all group space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards">
              <div className="flex items-start justify-between gap-2">
                <h3 aria-label={n.title} className="min-w-0 font-semibold text-sm leading-tight"><button type="button" onClick={()=>onOpen(n)} aria-label={`노트 열기: ${n.title}`} className="line-clamp-1 text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">{n.title}</button></h3>
                {tab==='mine' && (
                  <button type="button" aria-label={`노트 삭제: ${n.title}`} onClick={e=>{e.stopPropagation();setConfirmDeleteId(n.id);}} className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.content.slice(0,100).replace(/[#*`>-]/g,'') || '(내용 없음)'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {n.tags.slice(0,3).map(t=><span key={t} className="text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t}</span>)}
                <span className="text-xs text-muted-foreground ml-auto">{new Date(n.updated_at).toLocaleDateString('ko-KR')}</span>
                {n.is_shared && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <Share2 className="size-2.5" />공개
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function NotesPage(){const{user}=useAuth();return <NotesSession key={user?.id||'anonymous'}/>}
function NotesSession() {
  const { user } = useAuth();
  const {showError}=useAlert();
  const [editing, setEditing] = useState<Note | 'new' | 'list'>('list');
  const [recovery,setRecovery]=useState<NoteRecovery|null>(null);
  const [restoring,setRestoring]=useState(false);
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(active&&user)setRecovery(readNoteRecovery(noteRecoveryStorage(),user.id))});return()=>{active=false}},[user]);

  if (!user) return (
    <section className="cb-page-content px-4 py-16 flex flex-col items-center gap-4 text-center">
      <p className="font-semibold text-xl">로그인해 주세요</p>
    </section>
  );

  if (editing !== 'list'||restoring) {
    return (
      <div className="min-h-0">
        <NoteEditor
          note={restoring?recovery?.base??null:editing==='new'||editing==='list'?null:editing}
          recovery={restoring?recovery??undefined:undefined}
          onBack={() => {setEditing('list');setRestoring(false);setRecovery(readNoteRecovery(noteRecoveryStorage(),user.id))}}
          onSaved={(n) => setEditing(n)}
        />
      </div>
    );
  }

  return (
    <section className="cb-page-content px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="cb-page-title">연구노트</h1>
        <p className="cb-page-sub mt-1">마크다운 지원 · 자동 저장 · 공유 가능</p>
      </div>
      <Link href="/ai?tab=search&scope=notes" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm text-primary">의미로 연구노트 찾기 · AI 검색</Link>
      {recovery&&<div role="status" className="my-4 rounded-lg border p-4 text-sm"><p>이 브라우저 탭에 아직 저장하지 않은 노트가 있어요. 복구한 뒤 저장 여부를 확인해 주세요.</p><div className="mt-3 flex flex-wrap gap-2"><Button onClick={()=>setRestoring(true)}>작성하던 노트 복구</Button><Button variant="outline" onClick={()=>{clearNoteRecovery(noteRecoveryStorage(),user.id,recovery.id);setRecovery(null)}}>임시 내용 지우기</Button></div></div>}
      <NoteList onOpen={(n) => {if(recovery){showError('작성하던 노트를 복구하거나 임시 내용을 지운 뒤 다른 노트를 열어 주세요.');return}setEditing(n ?? 'new')}} />
    </section>
  );
}
