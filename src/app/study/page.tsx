'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, ExternalLink, RefreshCw, AlertTriangle, ChevronRight, User, Puzzle, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import SelfStudyReminderSettings from '@/components/study/SelfStudyReminderSettings';
import SupervisorCard from '@/components/study/SupervisorCard';
import {useAuth} from '@/lib/useAuth';
import {loadStudyRooms,formatStudentLabel,type RoomData,type OccupancyEntry,type Occupant} from '@/lib/studyRoomView';
import StudySeatBrowser from '@/components/study/StudySeatBrowser';
import StudyRequestPanel,{type StudyPrefill} from '@/components/study/StudyRequestPanel';
import {
  getRooms, getRoomComposition, getStudents,
  getSelfStudyPolicy, getPeriodCountForDate, localDateStr, searchSelfStudy,
  type Room, type Seat, type Obstacle, type Student,
} from '@/lib/eduset';

const OFFICIAL_STUDY_URL = 'https://cbsh.edu-set.com';
/** 정책을 못 받아왔을 때만 쓰는 최후의 추정치 */
const FALLBACK_MIN_PERIODS = 4;

function PeriodSelector({ periods, selectedPeriod, onSelect, className = '' }: {
  periods: number[];
  selectedPeriod: number;
  onSelect: (period: number) => void;
  className?: string;
}) {
  return (
    <SegmentedTabs
      items={periods.map((p) => ({ value: String(p), label: `${p}교시` }))}
      value={String(selectedPeriod)}
      onChange={(v) => onSelect(Number(v))}
      appearance="neutral"
      label="자습 교시 선택"
      className={className}
    />
  );
}

function SeatMap({ room, seats, obstacles, occupantsBySeat, selectedPeriod, failed, onRetry, onChoose }: {
  room: Room;
  seats: Seat[];
  obstacles: Obstacle[];
  occupantsBySeat: Map<number, Occupant[]>;
  selectedPeriod: number;
  failed?: boolean;
  onRetry: () => void;
  onChoose?: (seat: Seat) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const rows=seats.map(seat=>{
    const occupants=occupantsBySeat.get(seat.id)?.filter(o=>o.period===selectedPeriod)??[];
    return {seat,available:occupants.length===0,pending:occupants.length>0&&occupants.every(o=>o.status==='PENDING'),detail:occupants.map(o=>o.label).join(' · ')};
  });
  const selected=rows.find(row=>String(row.seat.id)===selectedId);
  if(failed)return <div role="alert" className="space-y-3 rounded-2xl border p-4"><p className="text-sm">좌석 현황을 불러오지 못했습니다. 빈자리 여부를 확인할 수 없습니다.</p><Button variant="outline" className="min-h-11" onClick={onRetry}>다시 불러오기</Button></div>;
  return <div className="min-w-0 space-y-4">
    <StudySeatBrowser items={rows} obstacles={obstacles} width={room.width} height={room.height} selectedId={selectedId} onSelect={seat=>setSelectedId(String(seat.id))} selectOccupied/>
    <div aria-live="polite" className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="min-w-0 flex-1">{selected?<><p className="font-semibold">{selected.seat.name}번 좌석 · {selected.available?'빈자리':selected.pending?'승인 대기':'신청됨'}</p><p className="mt-1 break-words text-xs text-muted-foreground">{selected.detail||`${selectedPeriod}교시에 신청할 수 있는 자리예요.`}</p></>:<p className="text-sm text-muted-foreground">좌석을 누르면 신청자와 신청 가능 여부를 확인할 수 있어요.</p>}</div>
      {selected&&<Button type="button" className="min-h-11" disabled={!selected.available||!onChoose} onClick={()=>onChoose?.(selected.seat)}>{selected.available?'이 자리 신청하기':'이미 신청된 자리'}</Button>}
    </div>
    <p className="text-xs text-muted-foreground">조회 시점의 현황이에요. 신청할 때 빈자리를 다시 확인해요.</p>
  </div>;
}

/** 정원제(좌석 없는) 자습실용 — 좌석 배치 대신 해당 교시 신청자만 단순 목록으로 보여준다 */
function CapacityList({ occupancy, selectedPeriod, failed, onRetry }: {
  occupancy: OccupancyEntry[]; selectedPeriod: number; failed?: boolean; onRetry?: () => void;
}) {
  const entries = occupancy.filter((o) => o.period === selectedPeriod);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-amber-600 dark:text-amber-400 font-bold">
          신청자 명단을 불러오지 못했습니다. 0명이 아니라 조회 실패일 수 있습니다.
        </p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">이 교시에 신청자가 없습니다.</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border">
      {entries.map((e, i) => (
        <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-base font-medium break-words">{e.label}</span>
          {e.status === 'PENDING' && (
            <span className="text-sm font-medium text-muted-foreground">승인 대기</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Follow the visible screen even when the browser zooms or its keyboard opens. */
function useStudyDialogViewport() {
  const [viewport, setViewport] = useState({ width: 0, height: 0, left: 0, top: 0 });
  useEffect(() => {
    const update = () => {
      const visual = window.visualViewport;
      setViewport({ width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight, left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0 });
    };
    update();window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => { window.removeEventListener('resize', update);window.visualViewport?.removeEventListener('resize', update);window.visualViewport?.removeEventListener('scroll', update); };
  }, []);
  return viewport;
}

export default function StudyPage() {
  const {user,isLoading:authLoading,isApproved}=useAuth();
  const generation=useRef(0),busy=useRef(false),lastDate=useRef('');
  const dialogViewport = useStudyDialogViewport();
  const [requestPrefill,setRequestPrefill]=useState<StudyPrefill|null>(null);
  const consumePrefill=useCallback(()=>setRequestPrefill(null),[]);
  const [roomData, setRoomData] = useState<RoomData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentsUnavailable,setStudentsUnavailable]=useState(false);
  const [periodCount, setPeriodCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [onlyAvailable,setOnlyAvailable]=useState(false);
  const [roomSort,setRoomSort]=useState('name');
  const [searchMode, setSearchMode] = useState<'room' | 'student'>('room');

  const loadData = useCallback(async (fresh = false) => {
    if(authLoading||!user||!isApproved||busy.current)return;
    busy.current=true;const request=++generation.current;
    const dateStr=localDateStr();
    if(lastDate.current&&lastDate.current!==dateStr){setRoomData([]);setAllStudents([]);setUpdatedAt(null);setOpenRoomId(null)}
    setLoading(true);
    setError('');

    try {
      const today = new Date();


      // 서로 의존하지 않는 요청은 전부 한꺼번에 시작한다. 예전엔 (방·정책·학생) → (신청 현황) → (방별 구성)
      // 순서로 기다려서 왕복 지연이 세 번 쌓였다. 학생 목록은 학생 검색에서만 쓰므로 화면 표시를 막지 않는다.
      const policyPromise = getSelfStudyPolicy().catch(() => null);
      void getStudents().then(rows=>{if(request===generation.current){setAllStudents(rows);setStudentsUnavailable(false)}}).catch(()=>{if(request===generation.current){setAllStudents([]);setStudentsUnavailable(true)}});

      // 전체 신청을 한 번 조회한다. 실패하면 오류를 표시하고 개별 조회로 확장하지 않는다.
      const [rooms, selfStudyEntries] = await Promise.all([
        getRooms(), searchSelfStudy({ date: dateStr }, { fresh }),
      ]);

      const data=await loadStudyRooms(rooms,selfStudyEntries,id=>getRoomComposition(id,{fresh}));
      if(request!==generation.current)return;
      if(dateStr!==localDateStr())throw Error('날짜가 바뀌었습니다. 새로고침해 주세요.');
      lastDate.current=dateStr;

      setRoomData(data);

      const policy = await policyPromise;
      const policyCount = policy ? getPeriodCountForDate(policy, today) : 0;
      if(request!==generation.current)return;
      if (policyCount > 0) {
        setPeriodCount(policyCount);
      } else {
        let maxObserved = 0;
        data.forEach(({occupancy})=>occupancy.forEach(row=>{maxObserved=Math.max(maxObserved,row.period)}));
        setPeriodCount(Math.max(FALLBACK_MIN_PERIODS, maxObserved));
      }
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      if(request===generation.current)setError(err instanceof Error ? err.message : '현황을 불러오지 못했습니다.');
    } finally {
      if(request===generation.current){busy.current=false;setLoading(false)}
    }
  }, [user?.id,authLoading,isApproved]);

  useEffect(()=>{
    setRoomData([]);setAllStudents([]);setStudentsUnavailable(false);setUpdatedAt(null);setError('');setOpenRoomId(null);lastDate.current='';
    if(!authLoading&&user&&!isApproved){setLoading(false);setError('승인된 계정만 조회할 수 있습니다.')}else void loadData();
    const refresh=()=>{if(document.visibilityState==='visible')void loadData()};
    const timer=setInterval(refresh,30_000);document.addEventListener('visibilitychange',refresh);
    return()=>{generation.current++;busy.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
  },[loadData]);

  const periods = useMemo(
    () => Array.from({ length: periodCount }, (_, i) => i + 1),
    [periodCount]
  );

  useEffect(() => {
    if (periodCount > 0 && selectedPeriod > periodCount) {
      setSelectedPeriod(1);
    }
  }, [periodCount, selectedPeriod]);

  const filteredRoomData = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roomData;
    return roomData.filter(({ room }) => room.name.toLowerCase().includes(q));
  }, [roomData, query]);

  /** Keep names stable between refreshes; optionally prioritize available seats. */
  const sortedRoomData = useMemo(() => {
    return filteredRoomData
      .map((d) => {
        const occupiedCount = d.room.hasSeats
          ? [...d.occupantsBySeat.values()].filter((list) => list.some((o) => o.period === selectedPeriod)).length
          : d.occupancy.filter((o) => o.period === selectedPeriod).length;
        return { ...d, occupiedCount };
      })
      .filter(d=>!onlyAvailable||(!d.failed&&d.room.hasSeats&&d.seats.length>d.occupiedCount))
      .sort((a,b)=>roomSort==='free'
        ? ((b.failed||!b.room.hasSeats? -1:b.seats.length-b.occupiedCount)-(a.failed||!a.room.hasSeats? -1:a.seats.length-a.occupiedCount))||a.room.name.localeCompare(b.room.name,'ko',{numeric:true})
        : a.room.name.localeCompare(b.room.name,'ko',{numeric:true}));
  }, [filteredRoomData, selectedPeriod,onlyAvailable,roomSort]);

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return allStudents
      .filter((s) => formatStudentLabel(s).toLowerCase().includes(q))
      .slice(0, 8);
  }, [allStudents, studentQuery]);

  const occupancyIndex = useMemo(() => roomData.flatMap((d) => d.occupancy), [roomData]);

  const selectedStudentEntry = useMemo(() => {
    if (!selectedStudent) return undefined;
    return occupancyIndex.find((e) => String(e.studentId) === String(selectedStudent.id) && e.period === selectedPeriod);
  }, [occupancyIndex, selectedStudent, selectedPeriod]);

  const openRoomData = openRoomId != null ? roomData.find((d) => d.room.id === openRoomId) : undefined;

  const clearStudentSearch = () => {
    setSelectedStudent(null);
    setStudentQuery('');
  };

  const openOfficialSite = () => {
    window.open(OFFICIAL_STUDY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <section aria-labelledby="study-heading" className="cb-page-content py-2 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="study-heading" className="text-3xl font-semibold tracking-tight">자습신청</h1>
          <p className="mt-2 text-sm text-muted-foreground">오늘의 자리를 고르고, 여러 교시를 한 번에 신청하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => loadData(true)}
            aria-label="자습 현황 새로고침"
            disabled={loading}
            className="flex items-center justify-center size-11 rounded-lg border bg-card transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button variant="outline" onClick={openOfficialSite} className="min-h-11 gap-2">
            <ExternalLink className="size-4" />
            <span>공식 사이트 열기</span><span className="sr-only"> (공식 사이트, 새 탭)</span>
          </Button>
        </div>
      </div>

      <SupervisorCard />
      <StudyRequestPanel prefill={requestPrefill} onPrefillConsumed={consumePrefill} onChanged={()=>void loadData(true)} />
      <div className="flex flex-wrap items-end justify-between gap-2 border-t pt-6"><div><h2 className="text-xl font-semibold tracking-tight">자리 둘러보기</h2><p className="mt-1 text-sm text-muted-foreground">교시 → 교실 → 좌석 순서로 선택하세요.</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">{new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}).format(new Date())}</span></div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{loading ? (roomData.length ? '현황 업데이트 중 · 이전 결과를 표시합니다.' : '자습 현황을 불러오는 중…') : updatedAt ? `최근 조회 ${updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${error ? ' · 업데이트 실패, 이전 결과입니다.' : ''}` : '아직 조회된 현황이 없습니다.'}</p>

      {/* 교시 — 가장 자주 바뀌는 축이라 검색 모드와 무관하게 항상 맨 위에 고정 */}
      {periods.length > 0 && (
        <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} className="-mx-1 px-1" />
      )}

      {/* 자습실 / 학생, 하나의 검색 흐름으로 통합 */}
      <div className="space-y-3">
        <SegmentedTabs
          appearance="neutral"
          label="검색 방법 선택"
          items={[{ value: 'room', label: '자습실로 찾기' }, { value: 'student', label: '학생으로 찾기' }]}
          value={searchMode}
          onChange={(v) => setSearchMode(v as 'room' | 'student')}
        />

        {searchMode === 'room' ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              aria-label="자습실 검색"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="어느 교실에서 자습할까요?"
              className="min-h-12 pl-9"
            />
          </div>
        ) : selectedStudent ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-sm">{formatStudentLabel(selectedStudent)}</p>
              <Button variant="ghost" size="sm" onClick={clearStudentSearch} className="font-bold text-xs">
                다른 학생 검색
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/10 p-3">
              <p className="text-sm">
                {selectedStudentEntry
                  ? `${selectedPeriod}교시: ${selectedStudentEntry.roomName}${
                      selectedStudentEntry.seatName ? ` ${selectedStudentEntry.seatName}번 자리` : ''
                    }에 신청했습니다.${selectedStudentEntry.status === 'PENDING' ? ' (승인 대기중)' : ''}`
                  : `${selectedPeriod}교시: 조회된 정보에서 신청 내역을 찾지 못했습니다. 공식 사이트에서도 확인해 주세요.`}
              </p>
              {selectedStudentEntry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 font-bold text-xs"
                  onClick={() => setOpenRoomId(selectedStudentEntry.roomId)}
                >
                  {selectedStudentEntry.seatName ? '좌석 보기' : '명단 보기'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={studentQuery}
              aria-label="학생 이름 또는 학번 검색"
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="이름 또는 학번으로 학생 검색"
              className="pl-9"
            />
            {studentQuery.trim() && (
              <div className="absolute z-10 mt-1 w-full rounded-2xl border border-border/60 bg-background shadow-lg divide-y divide-border/40 overflow-hidden max-h-72 overflow-y-auto">
                {studentMatches.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">일치하는 학생이 없습니다.</p>
                ) : (
                  studentMatches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      className="w-full p-3 text-left font-bold text-sm hover:bg-muted/40 transition-colors"
                    >
                      {formatStudentLabel(s)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {searchMode==='room'&&<div className="flex flex-wrap items-center justify-between gap-2"><button type="button" aria-pressed={onlyAvailable} onClick={()=>setOnlyAvailable(v=>!v)} className={'min-h-11 rounded-full border px-4 text-sm font-medium '+(onlyAvailable?'border-primary bg-primary/10 text-primary':'bg-card')}>빈자리 있는 교실만</button><label className="flex items-center gap-2 text-xs text-muted-foreground">정렬<select aria-label="자습실 정렬" value={roomSort} onChange={e=>setRoomSort(e.target.value)} className="min-h-11 rounded-lg border bg-card px-3 text-sm text-foreground"><option value="name">교실 이름순</option><option value="free">빈자리 많은 순</option></select></label></div>}

      {searchMode==='student'&&studentsUnavailable&&<p role="alert" className="text-sm text-destructive">학생 검색 목록을 불러오지 못했습니다. 교실별 조회는 계속 사용할 수 있어요. 새로고침해 주세요.</p>}

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => loadData(true)}>
            다시 시도
          </Button>
        </div>
      )}

      {loading && roomData.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={48} label="자습 현황 불러오는 중" />
        </div>
      ) : error && roomData.length === 0 ? null : sortedRoomData.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {roomData.length === 0 ? '아직 확인 가능한 자습실 데이터가 없습니다.' : '검색 결과가 없습니다.'}
          {(query||onlyAvailable) && <Button variant="outline" className="mt-4 min-h-11" onClick={() => {setQuery('');setOnlyAvailable(false)}}>전체 자습실 보기</Button>}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {sortedRoomData.map(({ room, seats, occupiedCount, failed }) => {
            const total = seats.length;
            const clickable = !!failed || (room.hasSeats ? total > 0 : true);
            return (
              <button
                key={room.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setOpenRoomId(room.id)}
                className="w-full flex items-center gap-3 px-4 py-5 sm:px-6 text-left first:rounded-t-2xl last:rounded-b-2xl enabled:hover:bg-muted enabled:active:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 disabled:cursor-default"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-semibold text-base break-words">{room.name}</p>
                    {failed ? (
                      <span className="text-sm text-destructive">조회 실패 · 새로고침해 주세요</span>
                    ) : room.hasSeats ? (
                      <span className="text-sm text-muted-foreground tabular-nums">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">빈자리 {Math.max(0,total-occupiedCount)}석</span> · 전체 {total}석
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground tabular-nums">
                        정원제 · {occupiedCount}명 신청
                      </span>
                    )}
                  </div>
                  {room.hasSeats&&!failed&&total>0&&<div className="h-1.5 max-w-48 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary/60" style={{width:`${Math.min(100,occupiedCount/total*100)}%`}}/></div>}
                  {clickable && <p className="text-xs text-muted-foreground">{room.hasSeats ? '좌석 선택하기' : '신청자 보기'}</p>}
                </div>
                {clickable && <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <details className="rounded-2xl border bg-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">알림 및 연결 설정</summary>
        <div className="flex flex-wrap items-center gap-3 pt-3"><SelfStudyReminderSettings /><Button asChild variant="outline" className="min-h-11"><Link href="/study/contribute"><Puzzle className="size-4" /> 연결 기여하기</Link></Button></div>
      </details>

      <Dialog open={openRoomId != null} onOpenChange={(open) => !open && setOpenRoomId(null)}>
        <DialogContent data-study-room-dialog showCloseButton={false}
          className="flex min-h-0 min-w-0 flex-col gap-0 p-0"
          style={{
            width: dialogViewport.width ? Math.min(768, Math.max(0, dialogViewport.width - 24)) : 'min(48rem, calc(100vw - 24px))',
            maxWidth: 'none',
            maxHeight: dialogViewport.height ? Math.max(0, dialogViewport.height - 24) : 'calc(100dvh - 24px)',
            left: dialogViewport.width ? dialogViewport.left + (dialogViewport.width - Math.min(768, Math.max(0, dialogViewport.width - 24))) / 2 : 12,
            top: dialogViewport.top + 12,
            translate: 'none', transform: 'none', animation: 'none', overflow: 'hidden',
          }}>
          {openRoomData && (
            <>
              <DialogHeader className="shrink-0 flex-row items-start gap-3 border-b p-3 text-left sm:p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <DialogTitle className="break-words leading-snug">{openRoomData.room.name} {openRoomData.room.hasSeats ? '좌석 배치' : '신청자 명단'}</DialogTitle>
                  <DialogDescription>{openRoomData.room.hasSeats ? '좌석을 누르면 신청자와 신청 가능 여부를 확인할 수 있어요.' : '정원제 자습실이라 좌석 없이 신청자만 표시됩니다.'}</DialogDescription>
                </div>
                <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label="자습실 창 닫기" className="size-11 shrink-0"><X className="size-5" /></Button></DialogClose>
              </DialogHeader>
              <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
              <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />
              {openRoomData.room.hasSeats ? (
                <><SeatMap
                  key={openRoomData.room.id}
                  room={openRoomData.room}
                  seats={openRoomData.seats}
                  obstacles={openRoomData.obstacles}
                  occupantsBySeat={openRoomData.occupantsBySeat}
                  selectedPeriod={selectedPeriod}
                  failed={openRoomData.failed}
                  onRetry={() => loadData(true)}
                  onChoose={error||loading?undefined:seat=>{setOpenRoomId(null);setRequestPrefill({roomId:openRoomData.room.id,seatId:seat.id,period:selectedPeriod})}}
                />{openRoomData.failed&&<><p className="text-sm text-destructive">{openRoomData.failedReason}</p><CapacityList occupancy={openRoomData.occupancy} selectedPeriod={selectedPeriod}/></>}
                </>
              ) : (
                <CapacityList
                  occupancy={openRoomData.occupancy}
                  selectedPeriod={selectedPeriod}
                  failed={openRoomData.failed}
                  onRetry={() => loadData(true)}
                />
              )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
