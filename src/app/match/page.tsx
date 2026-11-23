'use client';
import{studyMemberProfiles}from'@/lib/scopedProfiles';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { Plus, Users, X, Trash2, Lock, Sparkles } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { requestAi } from '@/lib/requestAi';
import { boundedClientRequest } from '@/lib/boundedClientRequest';

interface StudyPost {
  id: string; created_at: string; user_id: string;
  subject: string; title: string; description: string;
  tags: string[]; max_members: number; is_open: boolean;
}
interface Member { post_id: string; user_id: string; joined_at: string }
interface Profile { id: string; full_name: string | null; student_id: string | null; avatar_url: string | null }

const SUBJECTS = ['수학', '물리', '화학', '생물', '지구과학', '정보', 'AI/ML', '프로그래밍', '영어', '국어', '기타'];

function PostCard({
  post, members, myUserId, profileMap, onJoin, onLeave, onDelete, onClose,
}: {
  post: StudyPost; members: Member[]; myUserId: string; profileMap: Map<string, Profile>;
  onJoin: () => void; onLeave: () => void;
  onDelete: () => void; onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const postMembers = members.filter(m => m.post_id === post.id);
  // 글쓴이도 자기 스터디의 멤버다 — study_members엔 따로 들어가지 않으니 항상 합쳐서 센다
  const allMemberIds = [post.user_id, ...postMembers.map(m => m.user_id).filter(id => id !== post.user_id)];
  const cnt    = allMemberIds.length;
  const joined = allMemberIds.includes(myUserId);
  const isOwner = post.user_id === myUserId;
  const full   = cnt >= post.max_members;

  return (
    <div className="border border-border/50 rounded-2xl bg-card transition-all hover:bg-muted/10 tilt-3d">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="min-h-11 flex-1 min-w-0 text-left">
            <span className="flex items-center gap-2 flex-wrap mb-1">
              <Badge>{post.subject}</Badge>
              {!post.is_open && <Badge variant="muted" icon={<Lock className="size-2.5" />}>마감</Badge>}
              {joined && <Badge variant="success">참여 중</Badge>}
            </span>
            <span className="block font-semibold text-sm">{post.title}</span>
            {post.description && <span className="block text-sm text-muted-foreground mt-0.5 line-clamp-1">{post.description}</span>}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <Users className="size-3" />{cnt}/{post.max_members}
            </div>
            {isOwner && (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {post.is_open && <Button variant="ghost" size="icon" aria-label="스터디 모집 마감" className="size-11" onClick={onClose}><Lock className="size-3" /></Button>}
                <Button variant="ghost" size="icon" aria-label="스터디 삭제" className="size-11 text-destructive" onClick={onDelete}><Trash2 className="size-3" /></Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {post.tags.map(t => <Badge key={t} variant="muted">{t}</Badge>)}
        </div>
      </div>

      {open && (
        <div className="border-t border-border/20 p-4 space-y-3">
          {post.description && <p className="text-sm text-muted-foreground">{post.description}</p>}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-muted-foreground">참여 멤버 ({cnt}/{post.max_members})</p>
            <div className="flex flex-wrap gap-1.5">
              {allMemberIds.map(id => {
                const avatar = profileMap.get(id)?.avatar_url;
                return (
                  <span key={id} className="flex items-center gap-1.5 text-sm font-bold bg-muted pl-1 pr-2 py-1 rounded-lg">
                    {avatar ? (
                      <img src={avatar} alt="" className="size-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="size-5 rounded-full bg-muted-foreground/20 shrink-0" />
                    )}
                    {profileMap.get(id)?.full_name || '익명'}
                    {id === post.user_id && <span className="text-sm text-primary font-semibold">장</span>}
                  </span>
                );
              })}
            </div>
          </div>
          {post.is_open && !isOwner && (
            joined
              ? <Button variant="outline" size="sm" onClick={onLeave} className="font-semibold text-sm gap-1.5"><X className="size-3" />탈퇴</Button>
              : <Button size="sm" onClick={onJoin} disabled={full} className="font-semibold text-sm gap-1.5">
                  <Plus className="size-3" />{full ? '정원 초과' : '참여하기'}
                </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [subject,  setSubject]  = useState('수학');
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState<string[]>([]);
  const [max,      setMax]      = useState(4);
  const [saving,   setSaving]   = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const suggestedFromRef = useRef('');
  const submitting = useRef(false);
  const actor = useRef(user?.id); actor.current = user?.id;

  const suggestTags = async () => {
    const source = `${subject}\n${title}\n${desc}`.trim();
    if (source.length < 30 || suggestingTags || suggestedFromRef.current === source) return;
    suggestedFromRef.current = source;
    setSuggestingTags(true);
    try {
      const result = await requestAi('study_tags', source);
      setSuggestedTags(result.split(/[,，\n]+/).map(tag => tag.replace(/^[#\s\d.\-]+/, '').trim()).filter(tag => tag.length > 1 && tag.length <= 20).slice(0, 3));
    } catch { /* Optional suggestions never block group creation. */ }
    finally { setSuggestingTags(false); }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 5) setTags(tg => [...tg, t]);
    setTagInput('');
  };

  const submit = async () => {
    if (submitting.current) return;
    if (!title.trim()) { showError('제목을 입력해 주세요.'); return; }
    const owner = user?.id;
    if (!owner) { showError('로그인한 뒤 스터디를 만들어 주세요.'); return; }
    submitting.current = true;
    setSaving(true);
    try {
      const { error } = await boundedClientRequest(signal => supabase.from('study_posts').insert({ user_id: owner, subject, title, description: desc, tags, max_members: max, is_open: true }).abortSignal(signal), undefined, 30_000);
      if (error) throw error;
      if (actor.current !== owner) return;
      showSuccess('스터디를 만들었어요.');
      onCreated();
    } catch {
      if (actor.current === owner) showError('스터디 생성 결과를 확인하지 못했어요. 입력한 내용은 그대로 있어요. 목록을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !submitting.current) onCancel(); }}><DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-md"><DialogHeader className="shrink-0 px-4 pt-4 pb-3"><DialogTitle>새 스터디 만들기</DialogTitle><DialogDescription>과목과 인원을 정하고 함께 공부할 사람을 모아요.</DialogDescription></DialogHeader><div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
        <div className="flex gap-1.5 flex-wrap">
          {SUBJECTS.map(s => (
            <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)}
              className={`min-h-11 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${subject===s?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{s}</button>
          ))}
        </div>
        <div className="space-y-2"><label htmlFor="match-title" className="text-sm font-medium">스터디 제목 *</label><Input id="match-title" aria-label="스터디 제목" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 함께 푸는 물리 문제" className="font-bold" /></div>
        <div className="space-y-2"><label htmlFor="match-description" className="text-sm font-medium">설명 (선택)</label><Textarea id="match-description" aria-label="스터디 설명" value={desc} onChange={e => setDesc(e.target.value)} onBlur={suggestTags} placeholder="공부할 내용과 모임 방식을 적어 주세요" rows={3} className="resize-none" /></div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label htmlFor="match-max" className="mb-1 block text-sm font-medium">최대 인원</label>
            <Input id="match-max" aria-label="최대 인원" type="number" min={2} max={20} value={max} onChange={e => setMax(+e.target.value)} className="md:text-sm" />
          </div>
          <div className="flex-1">
            <label htmlFor="match-tags" className="mb-1 block text-sm font-medium">태그 (최대 5개)</label>
            <div className="flex gap-1">
              <Input id="match-tags" aria-label="추가할 태그" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => (e.key==='Enter'||e.key===',') && (e.preventDefault(),addTag())}
                placeholder="Enter로 추가" className="text-base min-h-11" />
            </div>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.map(t => <span key={t} className="flex items-center gap-1 text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {t}<button aria-label={`${t} 태그 제거`} className="flex size-11 items-center justify-center rounded-full" onClick={() => setTags(tg => tg.filter(x=>x!==t))}><X className="size-2.5" /></button>
            </span>)}
          </div>
        )}
        {(suggestingTags || suggestedTags.some(tag => !tags.includes(tag))) && <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite"><Sparkles className="size-3 text-primary" /><span>{suggestingTags ? '태그 추천 중…' : '추천 태그'}</span>{suggestedTags.filter(tag => !tags.includes(tag)).map(tag => <button key={tag} type="button" onClick={() => setTags(current => current.length < 5 && !current.includes(tag) ? [...current, tag] : current)} disabled={tags.length >= 5} className="min-h-11 rounded-full border border-primary/30 px-3 py-2 font-bold text-primary disabled:opacity-50">+ {tag}</button>)}</div>}
        <p className="text-sm text-muted-foreground">설명을 마치면 태그 추천을 위해 제목과 설명이 NVIDIA AI로 전송돼요.</p>
        </div><div className="shrink-0 border-t border-border bg-card p-4"><Button onClick={submit} disabled={saving} className="w-full font-semibold">
          {saving ? '만드는 중…' : '스터디 만들기'}
        </Button></div>
      </DialogContent></Dialog>
  );
}

export default function MatchPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [posts,   setPosts]   = useState<StudyPost[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [tab,     setTab]     = useState<'all'|'mine'>('all');
  const [filter,  setFilter]  = useState('');
  const [creating,setCreating]= useState(false);
  const [loading, setLoading] = useState(true);
  const [justFinished, setJustFinished] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const mutations = useRef(new Set<string>());
  const actor = useRef(user?.id); actor.current = user?.id;
  const generation = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true); setLoadError('');
    try {
    const [{ data: p, error }, { data: m, error: memberError }] = await Promise.all([
      supabase.from('study_posts').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('study_members').select('post_id, user_id, joined_at').limit(2000),
    ]);
    if (ticket !== generation.current) return;
    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    if (error || memberError) { setLoadError('스터디 정보를 불러오지 못했어요. 연결을 확인한 뒤 다시 불러와 주세요.'); setLoading(false); return; }
    setPosts((p ?? []) as StudyPost[]);
    setMembers((m ?? []) as Member[]);

    // study_members.user_id는 auth.users를 참조해서 profiles 임베드가 안 되니, 멤버로
    // 등장하는 user_id들 + 글쓴이들의 프로필을 따로 가져와서 클라이언트에서 매칭한다
    const ids = [...new Set([...(m ?? []).map((x: any) => x.user_id), ...(p ?? []).map((x: any) => x.user_id)])];
    if (ids.length > 0) {
      const { data: profs,error:profileError } = await studyMemberProfiles(supabase,ids);
      if (ticket !== generation.current) return;
      if(profileError)showError('참여자 표시 정보를 확인하지 못했어요.');
      setProfileMap(new Map((profs ?? []).map((pr: any) => [pr.id, pr as Profile])));
    }else{setProfileMap(new Map());
    }

    setLoading(false);
    setJustFinished(true);
    setTimeout(() => { if (ticket === generation.current) setJustFinished(false); }, 600);
    } catch {
      if (ticket === generation.current) setLoadError('스터디 정보를 불러오지 못했어요. 연결을 확인한 뒤 다시 불러와 주세요.');
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('study-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_posts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_members' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const mutate = async (postId: string, action: (owner: string, signal: AbortSignal) => PromiseLike<{ error: unknown }>, success?: string) => {
    const owner = user?.id;
    if (!owner || mutations.current.has(postId)) return;
    mutations.current.add(postId);
    try {
      const { error } = await boundedClientRequest(signal => action(owner, signal), undefined, 30_000);
      if (error) throw error;
      if (actor.current !== owner) return;
      if (success) showSuccess(success);
      void load();
    } catch {
      if (actor.current === owner) showError('처리 결과를 확인하지 못했어요. 스터디 목록을 다시 불러와 상태를 확인해 주세요.');
    } finally {
      mutations.current.delete(postId);
    }
  };
  const join = (postId: string) => mutate(postId, (owner, signal) => supabase.from('study_members').insert({ post_id: postId, user_id: owner }).abortSignal(signal), '참여했어요.');
  const leave = (postId: string) => mutate(postId, (owner, signal) => supabase.from('study_members').delete().eq('post_id', postId).eq('user_id', owner).abortSignal(signal), '스터디에서 나왔어요.');
  const del = (postId: string) => mutate(postId, (_, signal) => supabase.from('study_posts').delete().eq('id', postId).abortSignal(signal), '스터디를 삭제했어요.');
  const close = (postId: string) => mutate(postId, (_, signal) => supabase.from('study_posts').update({ is_open: false }).eq('id', postId).abortSignal(signal));

  if (dbMissing) return (
    <section className="cb-page-content px-4 py-16 flex flex-col items-center gap-4 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h1 className="cb-page-title">스터디를 준비하고 있어요</h1>
      <p className="text-sm text-muted-foreground">스터디 정보를 확인하지 못했어요. 잠시 후 다시 확인하거나 관리자에게 알려 주세요.</p><Button variant="outline" onClick={() => { setDbMissing(false); void load(); }}>다시 확인하기</Button>
    </section>
  );

  const myPostIds = posts.filter(p => p.user_id === user?.id).map(p => p.id);
  const myJoined  = members.filter(m => m.user_id === user?.id).map(m => m.post_id);
  const shown = posts
    .filter(p => tab === 'all' ? true : myPostIds.includes(p.id) || myJoined.includes(p.id))
    .filter(p => !filter || p.subject === filter || p.title.includes(filter) || p.tags.some(t => t.includes(filter)));

  return (
    <section className="cb-page-content py-4 space-y-6 max-w-2xl mx-auto">
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="스터디를 삭제할까요?" description="모집 글과 참여 정보가 삭제돼요. 되돌릴 수 없어요." confirmLabel="삭제"
        onConfirm={() => { del(confirmDeleteId!); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      {creating && <CreateForm onCreated={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cb-page-title">스터디 매칭</h1>
          <p className="cb-page-sub mt-1">같이 공부할 사람 구하기</p>
        </div>
        {user && <Button onClick={() => setCreating(true)} className="font-semibold gap-2"><Plus className="size-4" />만들기</Button>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedTabs
          items={[{ value: 'all', label: '전체' }, { value: 'mine', label: '참여 중' }]}
          value={tab}
          onChange={(v) => setTab(v as 'all' | 'mine')}
        />
        <div className="flex gap-1 flex-wrap">
          <button type="button" aria-pressed={!filter} onClick={() => setFilter('')}
            className={`min-h-11 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${!filter?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>전체</button>
          {SUBJECTS.map(s => (
            <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(f => f===s?'':s)}
              className={`min-h-11 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${filter===s?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>{s}</button>
          ))}
        </div>
      </div>

      {loading || justFinished ? <div className="py-16 flex items-center justify-center"><LoadingSpinner done={justFinished} size={56} label="모집글 불러오는 중" /></div>
      : loadError ? <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5"><p className="text-sm">{loadError}</p><Button variant="outline" onClick={() => void load()}>스터디 다시 불러오기</Button></div> : shown.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-2xl text-muted-foreground font-medium">아직 표시할 스터디가 없어요. 다른 과목을 선택하거나 새 스터디를 만들어 보세요.</div>
      ) : (
        <div className="space-y-3">
          {shown.map((post, i) => (
            <div key={post.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards">
              <PostCard post={post}
                members={members} myUserId={user?.id ?? ''} profileMap={profileMap}
                onJoin={() => join(post.id)} onLeave={() => leave(post.id)}
                onDelete={() => setConfirmDeleteId(post.id)} onClose={() => close(post.id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
