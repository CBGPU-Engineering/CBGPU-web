'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { Edit3, Save, X, RotateCcw, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { ResourceSelection, ResourcePanel, ResourceStatus } from '@/components/ui/resource-motion';
import { EmptyState, InlineFeedback } from '@/components/ui/product-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { timetableWeekDates } from '@/lib/timetablePresentation';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useCachedAi } from '@/lib/useCachedAi';
import {useSchoolScope}from'@/components/schools/SchoolScope';

const DAYS    = ['월', '화', '수', '목', '금'];
const MAX_P   = 7;
const PERIODS = Array.from({ length: MAX_P }, (_, i) => i + 1);

/** 과목마다 셀 전체를 파스텔로 칠하는 대신, 좌측 얇은 띠 + 텍스트 색으로만 구분한다 */
const COLORS = [
  { bar: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300' },
  { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  { bar: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-300' },
  { bar: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300' },
  { bar: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-300' },
  { bar: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-300' },
];
const cc: Record<string, typeof COLORS[number]> = {};
function subjectColor(n: string) {
  if (!n) return COLORS[0];
  if (!cc[n]) { const h = [...n].reduce((a, c) => a + c.charCodeAt(0), 0); cc[n] = COLORS[h % COLORS.length]; }
  return cc[n];
}

/** 학번은 학년(1자리)+반(1자리)+번호(2자리) 형식. 선생님은 이 필드를 학번이 아니라
 * 로그인용 아이디처럼 쓰기 때문에, 4자리 숫자이고 학년이 1~3인 경우에만 학생으로 간주한다. */
function parseStudentGradeClass(studentId?: string | null): { grade: number; cls: number } | null {
  if (!studentId || !/^\d{4}$/.test(studentId)) return null;
  const grade = +studentId[0];
  const cls = +studentId[1];
  if (grade < 1 || grade > 3 || cls < 1) return null;
  return { grade, cls };
}

type Cell = { subject: string; teacher: string; changed?: boolean };
type Grid = Record<number, Record<number, Cell>>;

export default function TimetablePage() {
  const { isAdmin, user, profile, isLoading: authLoading } = useAuth();
  const schoolScope=useSchoolScope();
  const activeSchool=schoolScope.status==='legacy'?'cbsh':schoolScope.status==='ready'?schoolScope.school?.id:null;
  const scopeKey=schoolScope.status==='legacy'?'legacy':schoolScope.status+':'+(activeSchool||'none')+':'+(user?.id||'none');
  const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;
  const manualAllowed=schoolScope.status==='legacy'||schoolScope.status==='ready'&&activeSchool==='cbsh';
  const canEditManual=isAdmin&&schoolScope.status==='legacy';

  const { showAlert, showError, showSuccess } = useAlert();
  const [grade,   setGrade]   = useState(1);
  const [cls,     setCls]     = useState(1);
  const [grades,  setGrades]  = useState([1, 2, 3]);
  const [classes, setClasses] = useState([1, 2, 3, 4]);
  const [grid,    setGrid]    = useState<Grid>({});
  const [draft,   setDraft]   = useState<Record<number, Record<number, string>>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestRef=useRef(0);
  const subjectTrigger=useRef<HTMLElement|null>(null);
  const [gridContext,setGridContext]=useState<{grade:number;cls:number;school:string}|null>(null);
  const [subjectDetail,setSubjectDetail]=useState<{day:number;period:number}|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [freshness,setFreshness]=useState<{stale:boolean;fetchedAt:string;weekStart:string|null}|null>(null);
  const [source,  setSource]  = useState<'comcigan' | 'manual'>('comcigan');
  const [dbMissing, setDbMissing] = useState(false);
  const visibleGrid=gridContext?.school===scopeKey?grid:{};
  const displayPeriods=schoolScope.status==='legacy'?PERIODS:Array.from({length:Math.min(12,Math.max(7,...Object.values(visibleGrid).flatMap(day=>Object.keys(day).map(Number))))},(_,i)=>i+1);
  const todayWd = (() => { const d = new Date().getDay(); return d === 0 ? -1 : d - 1; })();
  const todaySubjects = todayWd >= 0 && todayWd < 5
    ? displayPeriods.map(period => visibleGrid[todayWd]?.[period]?.subject).filter(Boolean)
    : [];
  const todayDate = new Date().toLocaleDateString('sv-SE');
  const prepInput = todaySubjects.length >= 2 && gridContext?.school===scopeKey && gridContext?.grade===grade && gridContext?.cls===cls ? `${activeSchool} ${todayDate} ${grade}학년 ${cls}반 시간표: ${todaySubjects.join(', ')}` : '';
  const prepTip = useCachedAi('timetable', prepInput, `timetable:${activeSchool}:${grade}:${cls}:${todayDate}`, !!prepInput && !loading && !editing && !freshness?.stale);

  const loadComcigan = useCallback(async (g: number, c: number, refresh = false) => {
    const request=++requestRef.current,requestScope=scopeKey;setLoading(true); setError('');
    if(!activeSchool){setLoading(false);setGrid({});return;}
    let verifiedManualFallback=schoolScope.status==='legacy';
    try {
      const session=schoolScope.status==='legacy'?null:(await supabase.auth.getSession()).data.session;
      if(schoolScope.status!=='legacy'&&!session)throw Error('로그인 후 학교 소속을 확인해주세요.');
      const res=await fetch(`/api/timetable?grade=${g}&class=${c}${refresh?'&refresh=1':''}${schoolScope.status==='legacy'?'':'&school_id='+encodeURIComponent(activeSchool)}`,{headers:session?{Authorization:'Bearer '+session.access_token}:{},cache:'no-store'});
      const json = await res.json();
      if (json.error){verifiedManualFallback ||=res.status===502&&json.code==='TIMETABLE_PROVIDER_ERROR'&&json.school_id==='cbsh';throw new Error(json.error);}
      if(request!==requestRef.current||scopeRef.current!==requestScope)return;
      setGrid(json.grid ?? {});setGridContext({grade:g,cls:c,school:requestScope});
      if (json.grades?.length)  setGrades(json.grades);
      if (json.classes?.length) setClasses(json.classes);
      setSource('comcigan');
      setFreshness({stale:!!json.stale,fetchedAt:json.fetchedAt||'',weekStart:json.weekStart||null});
    } catch (e: any) {
      if(request!==requestRef.current||scopeRef.current!==requestScope)return;
      setError(e.message ?? String(e));
      if(manualAllowed&&verifiedManualFallback)await loadManual(g,c,request,requestScope);else{setGrid({});setGridContext(null);setFreshness(null);}
    } finally {
      if(request===requestRef.current&&scopeRef.current===requestScope)setLoading(false);
    }
  }, [scopeKey,activeSchool,manualAllowed]); // eslint-disable-line

  const loadManual = useCallback(async (g: number, c: number, request:number,requestScope:string) => {
    const { data, error: dbErr } = await supabase
      .from('timetable').select('weekday,period,subject')
      .eq('grade', g).eq('class_num', c);
    if(request!==requestRef.current||scopeRef.current!==requestScope)return;
    if (dbErr?.message?.includes('does not exist')) { setDbMissing(true); return; }
    if(dbErr){setError(previous=>previous+' · 수동 시간표도 불러오지 못했어요.');return;}
    const g2: Grid = {};
    for (const r of (data ?? [])) {
      if (!g2[r.weekday]) g2[r.weekday] = {};
      g2[r.weekday][r.period] = { subject: r.subject, teacher: '' };
    }
    setGrid(g2);setGridContext({grade:g,cls:c,school:requestScope}); setSource('manual');setFreshness(null);
  }, []);

  const didInitRef = useRef<string|null>(null);
  useEffect(() => {
    if(authLoading||user&&!profile)return;
    if(didInitRef.current===scopeKey)return;
    requestRef.current++;setGrid({});setGridContext(null);setFreshness(null);setSubjectDetail(null);setEditing(false);setDbMissing(false);setError('');setLoading(false);
    didInitRef.current=scopeKey;
    if(!activeSchool)return;
    setGrades(schoolScope.status==='legacy'?[1,2,3]:[1]);setClasses(schoolScope.status==='legacy'?[1,2,3,4]:[1]);
    const own=activeSchool==='cbsh'?parseStudentGradeClass(profile?.student_id):null;
    const nextGrade=own?.grade||1,nextClass=own?.cls||1;setGrade(nextGrade);setCls(nextClass);void loadComcigan(nextGrade,nextClass);
  },[authLoading,user,profile,scopeKey,activeSchool,loadComcigan]);

  useEffect(()=>{
    if(!freshness?.stale||editing)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void loadComcigan(grade,cls,true)},60_000);
    return()=>clearInterval(timer);
  },[freshness?.stale,editing,grade,cls,loadComcigan]);

  const switchTo = (g: number, c: number) => {
    if (editing) { showAlert('편집 중에는 변경할 수 없습니다.', 'info'); return; }
    setGrade(g); setCls(c); loadComcigan(g, c);
  };

  const startEdit = () => {
    if(!canEditManual||gridContext?.school!==scopeKey)return;
    const d: typeof draft = {};
    for (const wd in grid) { d[+wd] = {}; for (const p in grid[+wd]) d[+wd][+p] = grid[+wd][+p].subject; }
    setDraft(d); setEditing(true);
  };

  const save = async () => {
    if(!canEditManual||gridContext?.school!==scopeKey)return;
    const savingScope=scopeKey;setSaving(true);
    const rows = [];
    for (let wd = 0; wd < 5; wd++)
      for (const p of PERIODS)
        rows.push({ grade, class_num: cls, weekday: wd, period: p, subject: draft[wd]?.[p] ?? '' });
    const { error: dbErr } = await supabase.from('timetable')
      .upsert(rows, { onConflict: 'grade,class_num,weekday,period' });
    setSaving(false);if(scopeRef.current!==savingScope)return;
    if (dbErr) { showError(dbErr.message); return; }
    const g2: Grid = {};
    for (let wd = 0; wd < 5; wd++) { g2[wd] = {}; for (const p of PERIODS) { const s = draft[wd]?.[p] ?? ''; if (s) g2[wd][p] = { subject: s, teacher: '' }; } }
    setGrid(g2); setEditing(false); showSuccess('저장됐습니다.');
  };

  const weekDates=timetableWeekDates(freshness?.weekStart);
  const detail=subjectDetail?visibleGrid[subjectDetail.day]?.[subjectDetail.period]:null;
  if(schoolScope.status!=='legacy'&&schoolScope.status!=='ready')return <section className="cb-page-content px-4 py-10 max-w-lg mx-auto">{schoolScope.status==='loading'?<LoadingSpinner/>:<EmptyState kind="search" title="학교를 먼저 확인해주세요" description={schoolScope.status==='unavailable'?schoolScope.error:'인증된 학교를 선택하면 해당 학교 시간표를 볼 수 있어요.'} action={<Button onClick={()=>void schoolScope.refresh()}>학교 소속 다시 확인</Button>}/>}</section>;
  if (dbMissing) return <section className="cb-page-content px-4 py-10 max-w-lg mx-auto"><EmptyState kind="search" title="시간표를 준비하고 있어요" description="학교 시간표 연결을 확인하고 있어요. 잠시 후 다시 확인하거나 관리자에게 알려 주세요." action={<Button onClick={()=>{setDbMissing(false);void loadComcigan(grade,cls,true)}}>다시 확인하기</Button>}/></section>;

  return (
    <section className="cb-page-content px-4 py-8 space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="cb-page-title">시간표</h1>
          <p className="cb-page-sub mt-1">
            {schoolScope.status==='legacy'?'충북과학고등학교':schoolScope.school?.official_name} ·{' '}
            <span className={source === 'comcigan' ? 'text-green-500' : 'text-amber-500'}>
              {source === 'comcigan' ? '컴시간 알리미' : '수동 데이터'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {!editing && (
            <Button variant="ghost" size="icon" aria-label="시간표 새로고침" className="min-h-11 min-w-11" onClick={() => loadComcigan(grade, cls, true)} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {canEditManual && !editing && (
            <Button onClick={startEdit} disabled={loading} variant="outline" size="sm" className="font-semibold text-xs gap-1.5 active:scale-95 transition-transform">
              <Edit3 className="size-3.5" /> 직접 편집
            </Button>
          )}
          {canEditManual && editing && (
            <div className="flex gap-2">
              <Button onClick={() => setDraft({})} variant="ghost" size="sm" className="font-semibold text-xs gap-1.5 text-muted-foreground active:scale-95 transition-transform">
                <RotateCcw className="size-3" />
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="font-semibold text-xs gap-1.5 active:scale-95 transition-transform">
                <X className="size-3" /> 취소
              </Button>
              <Button onClick={save} size="sm" disabled={saving} className="font-semibold text-xs gap-1.5 active:scale-95 transition-transform">
                <Save className="size-3" /> {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ResourceSelection label="시간표 학년 선택" disabled={editing}
          items={grades.map(g => ({ value: String(g), label: `${g}학년` }))}
          value={String(grade)}
          onChange={(v) => switchTo(Number(v), 1)}
        />
        <ResourceSelection label="시간표 반 선택" disabled={editing}
          items={classes.map(c => ({ value: String(c), label: `${c}반` }))}
          value={String(cls)}
          onChange={(v) => switchTo(grade, Number(v))}
        />
        {editing && <span className="text-xs font-semibold text-amber-500 flex items-center gap-1"><Edit3 className="size-3" /> 편집 모드</span>}
      </div>

      {source==='comcigan'&&freshness?.stale&&<div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">컴시간 최신 확인이 지연되어 마지막으로 확인한 시간표를 보여드려요. 대강·변경 사항은 반영되지 않았을 수 있어요.<span className="mt-1 block text-xs">마지막 확인: {freshness.fetchedAt?new Date(freshness.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'확인 불가'}{freshness.weekStart?' · '+freshness.weekStart+' 시작 주':''} · 자동으로 다시 확인해요.</span></div>}

      {error && source === 'manual' && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <AlertTriangle className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            컴시간 연결 실패 — 수동 데이터를 표시합니다.
            <span className="block text-muted-foreground/60 mt-0.5 font-normal">{error}</span>
          </p>
        </div>
      )}

      {prepTip && !editing && <p className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><span className="font-semibold text-primary">오늘의 복습 힌트 · </span>{prepTip}<span className="ml-1 text-muted-foreground">과목명만 참고한 제안이에요.</span></span></p>}

      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><ResourceStatus value={`${gridContext?.grade}:${gridContext?.cls}:${freshness?.weekStart}`}><span>{gridContext?`${gridContext.grade}학년 ${gridContext.cls}반`:''}{weekDates.length?` · ${weekDates[0].label}–${weekDates[4].label}`:''}</span></ResourceStatus><span role="status">{loading?'시간표를 확인하고 있어요':editing?'편집 후 저장해 주세요':'수업을 누르면 자세히 볼 수 있어요'}</span></div>
      {loading && !gridContext ? (
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner size={56} label="시간표 불러오는 중" />
        </div>
      ) : !gridContext ? <EmptyState kind="search" title="시간표를 가져오지 못했어요" description="연결을 확인한 뒤 다시 불러와 주세요." action={<Button onClick={()=>void loadComcigan(grade,cls,true)}>다시 불러오기</Button>}/> : (
        <ResourcePanel value={`${gridContext.grade}:${gridContext.cls}`} className="min-w-0">
        <div className="overflow-x-auto transition-opacity" aria-busy={loading} style={{opacity:loading?0.55:1}}>
          <table className="w-full table-fixed border-collapse" aria-label={`${gridContext.grade}학년 ${gridContext.cls}반 주간 시간표`}>
            <thead>
              <tr>
                <th className="w-6 sm:w-10 p-1" scope="col"><span className="sr-only">교시</span></th>
                {DAYS.map((day, i) => (
                  <th key={day} scope="col" className={`px-1 py-2 text-xs font-semibold text-center ${todayWd===i?'text-primary':'text-muted-foreground'}`}>
                    {weekDates[i]&&<span className="block mb-0.5 text-xs font-normal text-muted-foreground">{weekDates[i].label}</span>}{day}{todayWd===i&&<span className="block text-xs text-primary/70">오늘</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayPeriods.map(p => (
                <tr key={p}>
                  <th scope="row" className="p-1 text-center"><span className="text-xs font-semibold text-muted-foreground">{p}</span></th>
                  {DAYS.map((_, di) => {
                    const cell    = editing ? undefined : visibleGrid[di]?.[p];
                    const subject = editing ? (draft[di]?.[p] ?? '') : (cell?.subject ?? '');
                    const teacher = editing ? '' : (cell?.teacher ?? '');
                    const changed = !editing && !!cell?.changed;
                    const isToday = todayWd === di;
                    return (
                      <td key={di} className={`p-0.5 ${isToday?'bg-primary/[0.03]':''}`}>
                        {editing ? (
                          <input value={subject}
                            onChange={e => setDraft(prev => ({ ...prev, [di]: { ...prev[di], [p]: e.target.value } }))}
                            placeholder="과목"
                            className="w-full h-14 px-1.5 text-center text-xs font-bold rounded-lg border border-border/40 bg-muted/20 outline-none focus:border-primary focus:bg-background placeholder:text-muted-foreground/30 transition-colors"
                          />
                        ) : subject ? (
                          <button type="button" disabled={loading} onClick={event=>{subjectTrigger.current=event.currentTarget;setSubjectDetail({day:di,period:p})}} aria-label={`${DAYS[di]}요일 ${p}교시 ${subject}${teacher?' · '+teacher+' 선생님':''}${changed?' · 변경된 수업':''}`} title={`${subject}${teacher?' · '+teacher:''}${changed?' · 컴시간 실시간 변경':''}`}
                            className={`relative w-full h-16 sm:h-14 pl-2 pr-1 rounded-xl border border-border/40 bg-card text-center flex flex-col items-center justify-center gap-0.5 overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 transition-colors ${isToday?'ring-1 ring-primary/15':''} ${changed?'ring-2 ring-amber-500/60':''}`}>
                            <span className={`absolute inset-y-0 left-0 w-1 ${subjectColor(subject).bar}`} />
                            {changed && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500" />}
                            <ResourceStatus value={`${subject}:${teacher}`} className="cb-timetable-subject w-full"><span className="flex w-full min-w-0 flex-col items-center gap-0.5"><span className={`text-xs font-semibold leading-tight line-clamp-2 ${subjectColor(subject).text}`}>{subject}</span>{teacher&&<span className="block w-full truncate text-xs text-muted-foreground leading-tight">{teacher}</span>}</span></ResourceStatus>
                          </button>
                        ) : (
                          <div className="h-14 rounded-lg bg-muted/10 border border-transparent" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div></ResourcePanel>
      )}
      {error&&source!=='manual'&&<InlineFeedback kind="info" message={gridContext?'최신 시간표를 확인하지 못했어요. 표시된 학년·반과 마지막 조회 내역을 확인해 주세요.':'시간표 연결을 확인하지 못했어요. 다시 불러와 주세요.'}/>}
      <Dialog open={!!subjectDetail} onOpenChange={open=>{if(!open)setSubjectDetail(null)}}><DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto" onCloseAutoFocus={event=>{event.preventDefault();if(subjectTrigger.current?.isConnected)subjectTrigger.current.focus()}}><DialogHeader><DialogTitle>{detail?.subject||'수업 정보'}</DialogTitle><DialogDescription>{subjectDetail&&`${weekDates[subjectDetail.day]?.fullLabel||''} ${DAYS[subjectDetail.day]}요일 · ${subjectDetail.period}교시`}</DialogDescription></DialogHeader><dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-4 py-2 text-sm"><dt className="text-muted-foreground">학년·반</dt><dd>{gridContext?.grade}학년 {gridContext?.cls}반</dd><dt className="text-muted-foreground">담당 교사</dt><dd className="break-words">{detail?.teacher||'등록된 정보가 없어요'}</dd><dt className="text-muted-foreground">시간표</dt><dd>{source==='manual'?'수동 시간표':freshness?.stale?'마지막 조회 내역':'학교 시간표'}</dd></dl>{detail?.changed&&<InlineFeedback kind="info" message="학교 시간표에서 변경된 수업이에요."/>}{freshness?.stale&&<InlineFeedback kind="info" message="최신 확인이 지연되어 수업이 달라졌을 수 있어요."/>}</DialogContent></Dialog>
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 flex-wrap">
        <span>컴시간 알리미 자동 연동{manualAllowed&&' · 제공처 오류 시 교내 수동 데이터 표시'}{canEditManual&&' · 직접 편집 가능'}</span>
        {source === 'comcigan' && (
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" />실시간 보강/결강 변경</span>
        )}
      </p>
    </section>
  );
}
