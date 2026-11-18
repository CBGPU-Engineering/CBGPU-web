'use client';
import{scopedProfilesEnabled,initialContestStudentNumber,canShareContestStudentNumber}from'@/lib/scopedProfiles';
import {ScrollSection} from '@/components/ui/product-motion';
import ContestMarkdown from '@/components/contests/ContestMarkdown';
import ContestPresentationEditor from '@/components/contests/ContestPresentationEditor';
import{contestWorkspaceSections,contestEventSection,contestParticipantHref,contestManagementHref,type ContestManagementSection,type ContestEventSection}from'@/lib/contestWorkspace';
import '@/components/contests/contest-workspace.css';
import {ContestArtwork} from '@/components/contests/ContestArtwork';


import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Copy, Download, RefreshCw, Send, Users, FileUp, ShieldCheck, Layers3, FileText, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/spinner';
import ContestClock, { useContestClock } from '@/components/contests/ContestClock';
import { ContestLogo } from '@/components/contests/ContestLogo';
import ContestLogoEditor from '@/components/contests/ContestLogoEditor';
import EventHub from '@/components/contests/EventHub';
import ContestAwards from '@/components/contests/ContestAwards';
import {
  Contest, ContestTeam, ContestAnswers, ContestSubmission, SubmittedFile, CONTEST_BUCKET, FIELD_LABELS,
  contestClosed, contestSubmissionPhase,contestPeriodError, contestError, deadlineToISO, deadlineToInput, fileError,
  formatContestDate, isHttpUrl, validateAnswers,contestEventPhase,
} from '@/lib/contests';

async function downloadFile(file: SubmittedFile) {
  const { data, error } = await supabase.storage.from(CONTEST_BUCKET).download(file.path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function FileDownload({ file }: { file: SubmittedFile }) {
  const [busy, setBusy] = useState(false);
  const { showError } = useAlert();
  return <Button type="button" variant="outline" disabled={busy} className="max-w-full" onClick={async () => {
    setBusy(true);
    try { await downloadFile(file); } catch (error) { showError(contestError(error)); }
    finally { setBusy(false); }
  }}><Download /><span className="truncate">{busy ? '다운로드 중…' : file.name}</span></Button>;
}

function SubmissionForm({ contest, submission, closed, clockReady, onSaved, team, pending=false,preview=false }: {
  preview?:boolean;
  pending?:boolean;
  team?: ContestTeam|null;
  contest: Contest; submission: ContestSubmission | null; closed: boolean; clockReady: boolean;
  onSaved: (submission: ContestSubmission) => void;
}) {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [name, setName] = useState(preview?'':team?.name || submission?.participant_name || profile?.full_name || '');
  const [studentId, setStudentId] = useState(preview?'':initialContestStudentNumber(submission?.student_id,profile?.student_id));
  const [shareStudentNumber,setShareStudentNumber]=useState(false);
  const [answers, setAnswers] = useState<ContestAnswers>(submission?.answers || {});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const submitting = useRef(false);
  const update = (id: string, value: string) => setAnswers(prev => ({ ...prev, [id]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (preview || !user || submitting.current || closed || pending || !clockReady) return;
    if(contest.participation_mode==='team'&&!team)return showError('팀에 참가한 뒤 공동 제출물을 등록해 주세요.');
    if (!name.trim()) return showError('제출자 이름 또는 팀명을 입력해 주세요.');
    if(!canShareContestStudentNumber(studentId,shareStudentNumber,!!team))return showError('학번을 주최자에게 전달하는 데 동의하거나 학번을 지워주세요.');
    const validation = validateAnswers(contest.fields, answers, files);
    if (validation) return showError(validation);
    submitting.current = true;
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const nextAnswers: ContestAnswers = {};
      for (const field of contest.fields) {
        if (field.type !== 'file') {
          nextAnswers[field.id] = typeof answers[field.id] === 'string' ? (answers[field.id] as string).trim() : '';
          continue;
        }
        const file = files[field.id];
        if (!file) {
          if (typeof answers[field.id] === 'object') nextAnswers[field.id] = answers[field.id];
          continue;
        }
        setProgress(`${field.label} 업로드 중…`);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'file';
        const path = `${contest.id}/${user.id}/${field.id}/${crypto.randomUUID()}_${safeName}`;
        const { error } = await supabase.storage.from(CONTEST_BUCKET).upload(path, file, { upsert: false });
        if (error) throw error;
        uploaded.push(path);
        nextAnswers[field.id] = { path, name: file.name, size: file.size };
      }
      setProgress('제출 내용 저장 중…');
      const payload={participant_name:team?.name||name.trim(),student_id:team?(scopedProfilesEnabled()?submission?.student_id||'':''):String(studentId).trim(),...(scopedProfilesEnabled()?{student_id_consent:team?!!submission?.student_id_consent:!!studentId.trim()&&shareStudentNumber}:{}),answers:nextAnswers};
      const query=team
       ?submission?supabase.from('contest_submissions').update(payload).eq('contest_id',contest.id).eq('team_id',team.id).eq('user_id',submission.user_id)
        :supabase.from('contest_submissions').insert({...payload,contest_id:contest.id,user_id:user.id,team_id:team.id})
       :supabase.from('contest_submissions').upsert({...payload,contest_id:contest.id,user_id:user.id},{onConflict:'contest_id,user_id'});
      const {data,error}=await query.select('*').single();
      if (error) throw error;
      // Each submission is committed atomically. Failed cleanup cannot remove referenced files under RLS.
      const replaced = Object.values(submission?.answers || {}).filter((value): value is SubmittedFile => typeof value === 'object')
        .filter(old => !Object.values(nextAnswers).some(value => typeof value === 'object' && value.path === old.path)).map(file => file.path);
      if (replaced.length) {
        const { error: cleanupError } = await supabase.storage.from(CONTEST_BUCKET).remove(replaced);
        if (cleanupError) console.error('Contest file cleanup:', cleanupError.message);
      }
      showSuccess(submission ? '제출 내용을 수정했어요.' : '제출을 완료했어요!');
      onSaved(data);
    } catch (error) {
      if (uploaded.length) await supabase.storage.from(CONTEST_BUCKET).remove(uploaded).catch(() => {});
      showError((error as {code?:string})?.code==='23505'?'다른 팀원이 먼저 제출했어요. 새로고침하면 팀의 공동 제출물을 수정할 수 있어요.':contestError(error));
    } finally { submitting.current = false; setBusy(false); setProgress(''); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {pending&&<p role="status" className="rounded-2xl border bg-muted/40 p-4 text-sm">제출 시작 전이에요. {formatContestDate(contest.starts_at||null)}부터 제출할 수 있어요.</p>}
      {team&&<div role="status" className="rounded-2xl border bg-primary/5 p-4 text-sm"><strong>{team.name} · 팀 공동 제출</strong><p className="mt-2 text-muted-foreground">팀원 모두 같은 제출물과 파일을 보고 수정할 수 있어요. 마지막으로 제출한 내용이 팀의 최종 제출물이 됩니다.</p></div>}
      {submission && <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-5" />제출 완료</p><p className="mt-1 text-xs text-muted-foreground">마지막 제출: {formatContestDate(submission.submitted_at)}</p><p className="mt-2 text-sm">마감 전까지 내용을 수정할 수 있어요. 수정한 내용은 다시 제출해야 저장돼요.</p></div>}
      <fieldset disabled={preview || closed || pending || busy || !clockReady} className="space-y-5">
        <section className="contest-panel">
          <div className="contest-panel-heading"><span className="contest-step"><Users className="size-4" /></span><div><h2 className="font-bold">참가자 정보</h2><p className="mt-1 text-xs text-muted-foreground">제출물을 확인할 수 있도록 알려주세요.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-bold"><span>제출자 이름 / 팀명 <span className="text-destructive">*</span></span><Input readOnly={!!team} required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
          {!team&&<label className="space-y-2 text-sm font-bold"><span>학번 (선택)</span><Input maxLength={30} value={studentId} onChange={e => {setStudentId(e.target.value);setShareStudentNumber(false)}} />{scopedProfilesEnabled()&&<small className="block text-xs font-normal text-muted-foreground">학번 없이도 제출할 수 있어요. 다른 학교의 계정 학번은 자동으로 가져오지 않아요.</small>}</label>}
          {scopedProfilesEnabled()&&!team&&studentId.trim()&&<label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={shareStudentNumber} onChange={e=>setShareStudentNumber(e.target.checked)}/><span>입력한 학번을 이 대회 주최자·확정 팀원에게 제출 정보로 전달하는 데 동의해요. 원하지 않으면 학번을 지워주세요.</span></label>}
          </div>
        </section>
        {contest.fields.map((field, index) => {
          const value = answers[field.id];
          return <section key={field.id} className="contest-field-card space-y-4">
            <div className="flex items-center gap-3"><span className="contest-step">{String(index + 1).padStart(2, '0')}</span><label htmlFor={`answer-${field.id}`} className="block font-bold">{field.label} {field.required ? <span className="ml-1 rounded-md bg-primary/5 px-2 py-1 text-xs font-semibold text-primary">필수</span> : <span className="ml-1 text-xs font-normal text-muted-foreground">선택</span>}</label></div>
            <p className="text-xs text-muted-foreground">{FIELD_LABELS[field.type]}{field.type === 'file' ? ` · 파일 1개, 최대 ${field.max_size_mb}MB · ${field.extensions || '모든 확장자'}` : ''}</p>
            {field.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{field.description}</p>}
            {field.type === 'text' ? <textarea id={`answer-${field.id}`} required={field.required} maxLength={10000} rows={5} value={typeof value === 'string' ? value : ''} onChange={e => update(field.id, e.target.value)} className="w-full rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="내용을 입력해 주세요." /> : field.type === 'link' ? <Input id={`answer-${field.id}`} type="url" required={field.required} maxLength={2000} placeholder="https://" value={typeof value === 'string' ? value : ''} onChange={e => update(field.id, e.target.value)} /> : <div className="space-y-3">
              {typeof value === 'object' && <p className="break-words text-sm">현재 파일: {value.name}</p>}
              <div className="contest-file-zone"><FileUp className="mb-1 size-7 text-primary" strokeWidth={1.5} /><span className="max-w-full break-all text-sm font-semibold">{files[field.id]?.name || '클릭하거나 파일을 끌어 놓으세요'}</span><span className="text-xs text-muted-foreground">{field.extensions || '모든 파일 형식'} · 최대 {field.max_size_mb}MB</span><Input id={`answer-${field.id}`} aria-label={`${field.label} 파일 선택`} type="file" accept={field.extensions || undefined} required={field.required && !value} onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const error = fileError(file, field);
                  if (error) { showError(error); e.target.value = ''; setFiles(prev => { const next = { ...prev }; delete next[field.id]; return next; }); return; }
                }
                setFiles(prev => { const next = { ...prev }; if (file) next[field.id] = file; else delete next[field.id]; return next; });
              }} /></div>
              {files[field.id] && <p className="text-xs text-primary">새 파일: {files[field.id].name} · 다시 제출하면 교체돼요.</p>}
              {!field.required && (value || files[field.id]) && <Button type="button" variant="ghost" onClick={() => {
                setAnswers(prev => { const next = { ...prev }; delete next[field.id]; return next; });
                setFiles(prev => { const next = { ...prev }; delete next[field.id]; return next; });
                const input = document.getElementById(`answer-${field.id}`) as HTMLInputElement | null;
                if (input) input.value = '';
              }}>파일 제외하기</Button>}
            </div>}
          </section>;
        })}
        <p className="text-xs text-muted-foreground">{team?'제출 내용과 파일은 같은 팀원 및 대회 호스트만 볼 수 있어요. 팀당 한 건이며 모든 팀원이 수정할 수 있어요.':'제출 내용은 본인과 대회 호스트만 볼 수 있어요. 계정당 한 건을 제출하며 재제출하면 기존 내용이 갱신돼요.'}</p>
        <Button type="submit" size="lg" className="w-full"><Send />{preview?'참가자 화면 미리보기':busy ? progress || '제출 중…' : closed ? '제출이 마감되었어요' : pending?'아직 제출 시작 전이에요':!clockReady ? '서버 시각 확인 중…' : submission ? '수정 내용 다시 제출하기' : '작품 제출하기'}</Button>
      </fieldset>
      {submission && <section className="space-y-3"><h2 className="font-bold">저장된 제출 파일</h2>{Object.values(submission.answers).filter((value): value is SubmittedFile => typeof value === 'object').map(file => <div key={file.path}><FileDownload file={file} /></div>)}</section>}
    </form>
  );
}

function HostPanel({ contest, submissions, onUpdated, refresh, now, canEditIdentity,section='all' }: {
  section?:'all'|'share'|'submissions';
  contest: Contest; submissions: ContestSubmission[]; onUpdated: (contest: Contest) => void; refresh: () => Promise<void>; now: number | null; canEditIdentity: boolean;
}) {
  const [deadline, setDeadline] = useState(deadlineToInput(contest.ends_at));
  const [starts,setStarts]=useState(deadlineToInput(contest.starts_at||null));
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { showError, showSuccess } = useAlert();
  useEffect(() => { setShareUrl(new URL(contestParticipantHref(contest.id),window.location.origin).toString()); }, [contest.id]);

  async function update(patch: { is_open?: boolean; starts_at?:string|null; ends_at?: string | null }) {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('contests').update(patch).eq('id', contest.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      showSuccess('접수 설정을 변경했어요.');
    } catch (error) { showError(contestError(error)); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    {section!=='submissions'&&<><section className="contest-panel space-y-4"><div><p className="contest-eyebrow mb-2 text-primary">INVITE PARTICIPANTS</p><h2 className="text-lg font-bold">참가 링크 공유</h2></div><p className="text-sm text-muted-foreground">이 링크 하나로 참가 신청, 행사 안내와 작품 제출을 받아보세요.</p><div className="flex flex-wrap gap-2"><Input aria-label="참가 링크" className="min-w-0 flex-1" readOnly value={shareUrl} onFocus={e => e.target.select()} /><Button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); showSuccess('참가 링크를 복사했어요.'); } catch { showError('링크를 선택한 뒤 직접 복사해 주세요.'); } }}><Copy />복사</Button></div></section>
    {section==='all'&&canEditIdentity && <ContestLogoEditor contest={contest} onUpdated={onUpdated} />}</>}
    {section!=='share'&&<>
    <section className="contest-panel space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="contest-eyebrow mb-2 text-primary">RECEPTION</p><h2 className="text-lg font-bold">접수 관리</h2></div><Button variant="outline" disabled={busy} onClick={() => void update({ is_open: !contest.is_open })}>{contest.is_open ? '접수 중지하기' : '접수 재개하기'}</Button></div>
      <form onSubmit={event => {
        event.preventDefault();
        const endsAt = deadlineToISO(deadline);
        const startsAt=deadlineToISO(starts);
        const validation=contestPeriodError(startsAt,endsAt,'작품 제출');if(validation)return showError(validation);
        if (now === null) return showError('서버 시각 확인 후 다시 시도해 주세요.');
        if (endsAt && new Date(endsAt).getTime() <= now) return showError('새 마감 시간은 현재 서버 시각 이후로 지정해 주세요.');
        void update({ starts_at:startsAt,ends_at: endsAt });
      }} className="space-y-3"><label className="block space-y-2 text-sm font-bold"><span>제출 시작 (선택, 한국 시간)</span><Input type="datetime-local" step="1" value={starts} onChange={e=>setStarts(e.target.value)} disabled={busy}/></label><label className="block space-y-2 text-sm font-bold"><span>마감일·시간 (한국 시간, 초 단위)</span><Input type="datetime-local" step="1" value={deadline} onChange={e => setDeadline(e.target.value)} disabled={busy} /></label><p className="text-xs text-muted-foreground">시작을 비우면 즉시 제출할 수 있고, 마감을 비우면 마감 제한이 없어져요. 접수 중지 상태라면 접수도 재개해 주세요.</p><Button type="submit" variant="outline" disabled={busy || now === null}>제출 기간 저장</Button></form>
    </section>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5" />받은 제출물 {submissions.length}건</h2><Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); } finally { setBusy(false); } }}><RefreshCw />새로고침</Button></div>
      {!submissions.length ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">아직 작품 제출물이 없어요. 참가자에게 참가 링크를 공유해 주세요.</div> : submissions.map(submission => <details key={submission.team_id||submission.user_id} className="rounded-2xl border bg-card p-5"><summary className="cursor-pointer break-words font-bold">{submission.team_id&&<span className="mr-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">팀 공동 제출</span>}{submission.participant_name}{submission.student_id ? ` · ${submission.student_id}` : ''}<span className="mt-1 block text-xs font-normal text-muted-foreground">최종 제출 {formatContestDate(submission.submitted_at)}</span></summary><div className="mt-5 space-y-5 border-t pt-5">{contest.fields.map(field => {
        const value = submission.answers[field.id];
        return <div key={field.id} className="space-y-2"><h3 className="text-sm font-bold">{field.label}</h3>{!value ? <p className="text-sm text-muted-foreground">미제출</p> : typeof value === 'object' ? <FileDownload file={value} /> : field.type === 'link' && isHttpUrl(value) ? <a href={value} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-primary underline underline-offset-4">{value}</a> : <p className="whitespace-pre-wrap break-words text-sm">{value}</p>}</div>;
      })}</div></details>)}
    </section></>}
  </div>;
}

export default function ContestDetailPage({managementRoute=false}:{managementRoute?:boolean}={}) {
  const [activeSection,setActiveSection]=useState<ContestManagementSection>('overview');
  const [eventSection,setEventSection]=useState<ContestEventSection>('overview');
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<ContestSubmission[]>([]);
  const [eventOperatorRole, setEventOperatorRole] = useState<'owner' | 'manager' | 'checkin' | null>(null);
  const [ownTeam,setOwnTeam]=useState<ContestTeam|null>(null);
  const [teamSubmissionReady,setTeamSubmissionReady]=useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { now, syncError } = useContestClock();
  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const { data, error } = await supabase.from('contests').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('대회를 찾을 수 없어요. 공유받은 링크를 확인해 주세요.');
      const owner = data.host_id === user.id;
      let operatorRole: 'owner' | 'manager' | 'checkin' | null = owner ? 'owner' : null;
      if (!owner) {
        const { data: hostEntry } = await supabase.from('event_hosts').select('role').eq('contest_id', id).eq('user_id', user.id).maybeSingle();
        operatorRole = hostEntry?.role || null;
      }
      const operator = !!operatorRole;
      let team:ContestTeam|null=null;let teamReady=false;
      if(data.participation_mode==='team'&&!operator){
       const {data:membership,error:memberError}=await supabase.from('contest_team_members').select('team_id,registration_status').eq('contest_id',id).eq('user_id',user.id).maybeSingle();if(memberError)throw memberError;
       if(membership){const {data:entry,error:teamError}=await supabase.from('contest_teams').select('*').eq('id',membership.team_id).maybeSingle();if(teamError)throw teamError;team=entry;const {data:confirmed,error:rosterError}=await supabase.from('contest_team_members').select('user_id').eq('team_id',membership.team_id).eq('registration_status','confirmed');if(rosterError)throw rosterError;const count=confirmed?.length||0;teamReady=membership.registration_status==='confirmed'&&count>=(data.team_min_size||2)&&count<=(data.team_max_size||5);}
      }
      setOwnTeam(team);setTeamSubmissionReady(teamReady);
      if(managementRoute&&(!operator||operatorRole==='checkin')){setContest(data);setEventOperatorRole(operatorRole);setSubmissions([]);return;}
      let query = supabase.from('contest_submissions').select('*').eq('contest_id', id).order('submitted_at', { ascending: false });
      if (!operator||!managementRoute) query = team?query.eq('team_id',team.id):query.eq('user_id', user.id);
      const { data: entries, error: entriesError } = await query;
      if (entriesError) throw entriesError;
      setContest(data);
      setEventOperatorRole(operatorRole);
      setSubmissions(entries || []);
    } catch (error) { setError(contestError(error)); }
    finally { setLoading(false); }
  }, [id, user,managementRoute]);
  useEffect(() => { void load();const refresh=()=>void load();window.addEventListener('cbgpu:contest-registration',refresh);return()=>window.removeEventListener('cbgpu:contest-registration',refresh); }, [load]);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const refreshSettings = async () => {
      const { data, error } = await supabase.from('contests').select('*').eq('id', id).maybeSingle();
      if (!disposed && !error && data) setContest(data);
    };
    const interval = setInterval(() => {void refreshSettings();if(contest?.participation_mode==='team')void load();}, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshSettings(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [id, user,contest?.participation_mode,load]);
  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (error || !contest) return <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border p-8"><p role="alert">{error || '대회를 찾을 수 없어요.'}</p><Button variant="outline" onClick={() => void load()}>다시 불러오기</Button><Button asChild variant="ghost"><Link href="/contests">대회 목록</Link></Button></div>;
  const isOwner = contest.host_id === user?.id;
  const isHost = isOwner || !!eventOperatorRole;
  const canManage = isOwner || eventOperatorRole === 'manager';
  const ownSubmission = submissions.find(entry => ownTeam?entry.team_id===ownTeam.id:entry.user_id===user?.id) || null;
  const phase=contestEventPhase(contest,now),phaseLabel={checking:'일정 확인 중',cancelled:'취소됨',archived:'보관됨',ended:'대회 종료',upcoming:'시작 예정',ongoing:'진행 중',unscheduled:'일정 미정'}[phase];
  const participantPath=contestParticipantHref(contest.id),managementPath=contestManagementHref(contest.id);
  const sections=contestWorkspaceSections(canManage,isOwner),selected=sections.find(section=>section.id===activeSection)||sections[0];
  const chooseSection=(section:ContestManagementSection)=>{setActiveSection(section);if(contestEventSection(section))setEventSection(section)};
  if(managementRoute&&!isHost)return <section className="contest-panel mx-auto max-w-2xl space-y-4"><h1 className="text-xl font-bold">대회 운영진만 관리할 수 있어요</h1><p className="text-sm text-muted-foreground">참가자 화면에서 안내와 본인 신청 내역을 확인해 주세요.</p><Button asChild variant="outline"><Link href={participantPath}>참가자 화면으로</Link></Button></section>;
  if(managementRoute)return <div className="contest-page mx-auto max-w-6xl space-y-6" data-contest-management>
    <Link href="/contests" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>대회 목록</Link>
    <header className="contest-management-header"><div className="min-w-0"><p className="contest-eyebrow">대회 관리</p><h1>{contest.title}</h1><p>운영 도구는 여기에서, 참가자에게 보이는 화면은 따로 확인하세요.</p></div><div className="contest-management-actions"><span className="contest-event-state" data-phase={phase}>{phaseLabel}</span><Button asChild variant="outline"><Link href={participantPath}>참가자 화면 보기</Link></Button><Button variant="ghost" onClick={()=>void load()}><RefreshCw/>새로고침</Button></div></header>
    <div className="contest-management-layout"><nav className="contest-management-nav" aria-label="대회 관리 항목">{sections.map(section=><button type="button" key={section.id} aria-pressed={selected.id===section.id} onClick={()=>chooseSection(section.id)}>{section.label}</button>)}</nav>
    <div className="contest-management-content"><header className="contest-management-section-heading"><h2>{selected.label}</h2><p>{selected.description}</p></header>
      <div hidden={selected.id!=='overview'}><HostPanel section="share" contest={contest} submissions={submissions} onUpdated={setContest} refresh={load} now={now} canEditIdentity={false}/></div>
      <div hidden={!contestEventSection(selected.id)}><EventHub now={now} view="management" managementSection={canManage?eventSection:'guests'} contest={contest} isHost={isHost} isOwner={isOwner} canManage={canManage} onContestUpdated={setContest}/></div>
      {canManage&&<><div hidden={selected.id!=='submissions'}><HostPanel section="submissions" contest={contest} submissions={submissions} onUpdated={setContest} refresh={load} now={now} canEditIdentity={false}/></div><div hidden={selected.id!=='awards'}><ContestAwards view="management" contestId={contest.id} submissionOwnerId={ownSubmission?.user_id||null}/></div><div hidden={selected.id!=='presentation'}><div className="space-y-6"><ContestPresentationEditor contest={contest} onUpdated={setContest}/>{isOwner&&<ContestLogoEditor contest={contest} onUpdated={setContest}/>}</div></div></>}
    </div></div>
  </div>;
  const preview=isHost;
  return <div className="contest-page mx-auto max-w-6xl space-y-7" data-contest-participant>
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/contests" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>대회 목록</Link><span className="contest-event-state" data-phase={phase}>{phaseLabel}</span></div>
    {preview&&<section className="contest-preview-notice"><div><strong>참가자 화면 미리보기</strong><p>관리 도구 없이 안내와 신청·제출 화면을 확인해요. 미리보기에서는 신청·제출·투표가 실행되지 않아요.</p></div><Button asChild variant="outline"><Link href={managementPath}>대회 관리로 돌아가기</Link></Button></section>}
    <header className="contest-detail-hero"><div className="contest-detail-art" data-contest-detail-art={contest.id}><ContestArtwork id={contest.id} banner={contest.banner_path}/></div><div className="contest-detail-hero-body"><div className="contest-detail-identity"><ContestLogo path={contest.logo_path} title={contest.title} className="contest-logo-large"/><div className="min-w-0"><p className="contest-eyebrow">대회 안내</p><h1>{contest.title}</h1></div></div><div className="contest-detail-tags"><span><Layers3 className="size-3.5"/>제출 항목 {contest.fields.length}개</span><span><Users className="size-3.5"/>{contest.participation_mode==='team'?`팀 ${contest.team_min_size}–${contest.team_max_size}명`:'개인 참가'}</span><span><ShieldCheck className="size-3.5"/>{contest.participation_mode==='team'?'팀원과 주최자에게만 제출물 공개':'본인과 주최자에게만 제출물 공개'}</span></div></div><div className="px-5 pb-6 sm:px-8"><Button asChild><Link href="#contest-participation">참가 안내 보기</Link></Button></div></header>
    {contest.description&&<ScrollSection className="contest-panel" title="대회 소개"><ContestMarkdown>{contest.description}</ContestMarkdown></ScrollSection>}
    <div className="contest-detail-layout"><aside className="contest-summary space-y-4"><ScrollSection><ContestClock startsAt={contest.starts_at||null} endsAt={contest.ends_at} isOpen={contest.is_open} now={now} syncError={syncError}/></ScrollSection><section className="contest-panel"><h2 className="mb-4 text-sm font-bold">제출 항목 안내</h2><ul className="space-y-4">{contest.fields.map(field=><li key={field.id} className="min-w-0"><p className="break-words text-sm font-semibold">{field.label} · {field.required?'필수':'선택'}</p><p className="mt-1 break-words text-xs text-muted-foreground">{FIELD_LABELS[field.type]}{field.type==='file'?` · ${field.extensions||'모든 형식'} · ${field.max_size_mb}MB`:''}</p></li>)}</ul></section></aside>
    <div className="contest-detail-main space-y-7"><div id="contest-participation" className="scroll-mt-24"><EventHub view={preview?'preview':'participant'} now={now} contest={contest} isHost={isHost} isOwner={isOwner} canManage={canManage} onContestUpdated={setContest}/></div>
      {!preview&&contest.participation_mode==='team'&&(!ownTeam||!teamSubmissionReady)?<section className="contest-panel text-sm text-muted-foreground">{ownTeam?'본인 참가와 팀 구성 인원이 확정되면 팀 공동 제출물을 작성할 수 있어요.':'팀 참가 신청을 완료하면 팀 공동 제출물을 작성할 수 있어요. 개인 신청자는 마감 후 팀 배정을 기다려 주세요.'}</section>:<SubmissionForm preview={preview} pending={contestSubmissionPhase(contest,now)==='pending'} team={preview?null:ownTeam} key={`${contest.id}-${ownSubmission?.submitted_at||'new'}`} contest={contest} submission={preview?null:ownSubmission} closed={now!==null&&contestClosed(contest,now)} clockReady={now!==null} onSaved={entry=>setSubmissions([entry])}/>}
      <ContestAwards view={preview?'preview':'participant'} contestId={contest.id} submissionOwnerId={preview?null:ownSubmission?.user_id||null}/>
    </div></div>
  </div>;
}
