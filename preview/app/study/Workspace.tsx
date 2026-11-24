'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Armchair, ArrowUpRight, ChevronRight, RefreshCw, X } from 'lucide-react';
import { motion, LayoutGroup, useReducedMotion } from 'motion/react';
import SelfStudyReminderSettings from '@/components/study/SelfStudyReminderSettings';
import SupervisorCard from '@/components/study/SupervisorCard';
import { useAuth } from '@/lib/useAuth';
import { useSchoolResourcePermission, useSchoolResourceScope } from '@/components/schools/SchoolResourceScope';
import { loadStudyRooms, formatStudentLabel, type RoomData } from '@/lib/studyRoomView';
import StudySeatBrowser from '@/components/study/StudySeatBrowser';
import StudyRequestPanel, { type StudyPrefill } from '@/components/study/StudyRequestPanel';
import { getRooms, getRoomComposition, getStudents, getSelfStudyPolicy, getPeriodCountForDate, localDateStr, searchSelfStudy, type Student } from '@/lib/eduset';
import FeatureProviders from '../../components/FeatureProviders';
import { Notice } from '../../components/DirectoryFeedback';
import { OptionPicker } from '../../components/OptionPicker';
import styles from '../../components/SchoolOps.module.css';

const FALLBACK_MIN_PERIODS = 4;

export default function Workspace() {
  return <FeatureProviders><Study /></FeatureProviders>;
}

function Study() {
  const {user,isLoading:authLoading,isApproved}=useAuth();
  const permission=useSchoolResourcePermission('study',isApproved),resourceScope=useSchoolResourceScope();
  const canStudy=permission.enabled?permission.allowed&&resourceScope.current?.school_id==='cbsh':isApproved;
  const permissionLoading=permission.enabled&&permission.status==='loading';
  const permissionMessage=permission.enabled?permission.reason:'계정 승인을 마친 뒤 조회할 수 있어요.';
  const generation=useRef(0),busy=useRef(false),lastDate=useRef('');
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
  useEffect(()=>{try{const saved=localStorage.getItem('cbgpu:study:room-sort');if(['name','occupied','free'].includes(saved||''))setRoomSort(saved!)}catch{}},[]);
  const changeRoomSort=(value:string)=>{if(!['name','occupied','free'].includes(value))return;setRoomSort(value);try{localStorage.setItem('cbgpu:study:room-sort',value)}catch{}};
  const [searchMode, setSearchMode] = useState<'room' | 'student'>('room');

  const loadData = useCallback(async (fresh = false) => {
    if(authLoading||!user||!canStudy||busy.current)return;
    busy.current=true;const request=++generation.current;
    const dateStr=localDateStr();
    if(lastDate.current&&lastDate.current!==dateStr){setRoomData([]);setAllStudents([]);setUpdatedAt(null);setOpenRoomId(null)}
    setLoading(true);
    setError('');

    try {
      const today = new Date();


      // Fetch the search roster independently so the room list can render first.
      const policyPromise = getSelfStudyPolicy().catch(() => null);
      void getStudents().then(rows=>{if(request===generation.current){setAllStudents(rows);setStudentsUnavailable(false)}}).catch(()=>{if(request===generation.current){setAllStudents([]);setStudentsUnavailable(true)}});

      // Failed occupancy data must not be interpreted as free seats.
      const [rooms, selfStudyEntries] = await Promise.all([
        getRooms(), searchSelfStudy({ date: dateStr }, { fresh }),
      ]);

      const data=await loadStudyRooms(rooms,selfStudyEntries,id=>getRoomComposition(id,{fresh}));
      if(request!==generation.current)return;
      if(dateStr!==localDateStr())throw Error('날짜가 바뀌었어요. 새로고침해 주세요.');
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
      if(request===generation.current)setError(err instanceof Error ? err.message : '자습 현황을 불러오지 못했어요. 다시 불러와 주세요.');
    } finally {
      if(request===generation.current){busy.current=false;setLoading(false)}
    }
  }, [user?.id,authLoading,canStudy]);

  useEffect(()=>{
    setRoomData([]);setAllStudents([]);setStudentsUnavailable(false);setUpdatedAt(null);setError('');setOpenRoomId(null);lastDate.current='';
    if(!authLoading&&user&&!canStudy){setLoading(permissionLoading);if(!permissionLoading)setError(permissionMessage)}else void loadData();
    const refresh=()=>{if(document.visibilityState==='visible')void loadData()};
    const timer=setInterval(refresh,30_000);document.addEventListener('visibilitychange',refresh);
    return()=>{generation.current++;busy.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
  },[loadData,permissionLoading,permissionMessage,canStudy]);

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

  // Sort known counts ahead of rooms with unavailable occupancy.
  const sortedRoomData = useMemo(() => {
    return filteredRoomData
      .map((d) => {
        const occupiedCount = d.room.hasSeats
          ? [...d.occupantsBySeat.values()].filter((list) => list.some((o) => o.period === selectedPeriod)).length
          : d.occupancy.filter((o) => o.period === selectedPeriod).length;
        return { ...d, occupiedCount };
      })
      .filter(d=>!onlyAvailable||(!d.failed&&d.room.hasSeats&&d.seats.length>d.occupiedCount))
      .sort((a,b)=>roomSort==='occupied'
        ? ((b.failed?-1:b.occupiedCount)-(a.failed?-1:a.occupiedCount))||a.room.name.localeCompare(b.room.name,'ko',{numeric:true})
        : roomSort==='free'
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

  const ref = useRef<HTMLDialogElement>(null);
  const [seatId, setSeatId] = useState('');
  const reduced = useReducedMotion();
  const closeRoom = () => { setOpenRoomId(null); setSeatId(''); };
  useEffect(() => {
    const dialog = ref.current;
    if (openRoomData && dialog && !dialog.open) dialog.showModal();
    if (!openRoomData && dialog?.open) dialog.close();
  }, [openRoomData]);
  const periodSwitch = <div className={styles.inline} role="group" aria-label="자습 교시 선택">
    {periods.map(period => <button key={period} type="button" className={styles.secondary}
      aria-pressed={selectedPeriod === period} onClick={() => { setSelectedPeriod(period); setSeatId(''); }}>
      {period}교시
    </button>)}
  </div>;

  if (authLoading || permissionLoading) return <p role="status">자습 이용 권한을 확인하고 있어요.</p>;
  if (!user) return <Notice title="로그인하면 오늘의 자습실을 볼 수 있어요"><Link href="/auth/login?next=%2Fnew%2Fstudy">로그인</Link></Notice>;
  if (!canStudy) return <Notice title="이 학교의 자습 신청을 이용할 수 없어요"><p>{permissionMessage}</p></Notice>;

  const seatRows = openRoomData?.seats.map(seat => {
    const occupants = (openRoomData.occupantsBySeat.get(seat.id) || []).filter(item => item.period === selectedPeriod);
    return { seat, available: occupants.length === 0, pending: occupants.some(item => item.status === 'PENDING'), detail: occupants.map(item => item.label).join(', ') };
  }) || [];
  const seat = seatRows.find(item => String(item.seat.id) === seatId);
  const roomOccupants = openRoomData?.occupancy.filter(item => item.period === selectedPeriod) || [];

  return <div className={styles.stack}>
    <div className={styles.inline}>
      <a className={styles.secondary} href="https://cbsh.edu-set.com" target="_blank" rel="noopener noreferrer">
        EduSet 열기<ArrowUpRight size={16} aria-hidden />
      </a>
      <button type="button" className={styles.secondary} onClick={() => void loadData(true)} disabled={loading}>
        <RefreshCw size={16} aria-hidden />다시 불러오기
      </button>
    </div>
    <SupervisorCard />
    <StudyRequestPanel prefill={requestPrefill} onPrefillConsumed={consumePrefill} onChanged={() => void loadData(true)} />
    <section className={styles.panel} aria-labelledby="preview-study-rooms">
      <header className={styles.heading}>
        <h2 id="preview-study-rooms">오늘의 자습실</h2>
        <p role="status">{loading ? '자리 현황을 확인하고 있어요.' : updatedAt ? '마지막 조회 ' + updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '교시를 골라 자습실별 빈자리를 볼 수 있어요.'}</p>
      </header>
      {periodSwitch}
      <div className={styles.inline} role="group" aria-label="자습실 탐색 방법">
        <button type="button" className={styles.secondary} aria-pressed={searchMode === 'room'} onClick={() => setSearchMode('room')}>자습실로 찾기</button>
        <button type="button" className={styles.secondary} aria-pressed={searchMode === 'student'} onClick={() => setSearchMode('student')}>학생으로 찾기</button>
      </div>
      {searchMode === 'room' ? <>
        <label className={styles.field}>자습실 이름
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className={styles.inline}>
          <OptionPicker label="정렬" value={roomSort} onChange={changeRoomSort}
            options={[{ value: 'name', label: '교실 이름순' }, { value: 'occupied', label: '사람 많은 순' }, { value: 'free', label: '빈자리 많은 순' }]} />
          <button type="button" className={styles.secondary} aria-pressed={onlyAvailable} onClick={() => setOnlyAvailable(value => !value)}>빈자리 있는 실만</button>
        </div>
      </> : <>
        <label className={styles.field}>학생 이름 또는 학번
          <input type="search" value={studentQuery} onChange={event => { setStudentQuery(event.target.value); setSelectedStudent(null); }} />
        </label>
        {studentsUnavailable ? <p role="alert">학생 목록을 불러오지 못했어요. 자습실별 조회는 계속 할 수 있어요.</p>
          : selectedStudent ? <div className={styles.panel}>
            <strong>{formatStudentLabel(selectedStudent)}</strong>
            {selectedStudentEntry
              ? <button type="button" className={styles.secondary} onClick={() => setOpenRoomId(selectedStudentEntry.roomId)}>
                {selectedPeriod}교시 · {selectedStudentEntry.roomName}{selectedStudentEntry.seatName ? ' · ' + selectedStudentEntry.seatName + '번' : ''}
              </button> : <p>{selectedPeriod}교시 신청 내역이 없어요.</p>}
          </div> : studentQuery.trim() && (studentMatches.length ? <ul className="pv-list">
            {studentMatches.map(student => <li key={student.id}><button type="button" className={styles.secondary} onClick={() => setSelectedStudent(student)}>{formatStudentLabel(student)}</button></li>)}
          </ul> : <p role="status">검색 결과가 없어요. 이름이나 학번을 확인해 주세요.</p>)}
      </>}
      {error && <Notice title={error}><button type="button" className={styles.secondary} onClick={() => void loadData(true)}>다시 불러오기</button></Notice>}
      {searchMode === 'room' && sortedRoomData.length > 0
        ? <LayoutGroup><ul className="pv-list">{sortedRoomData.map(({ room, seats, occupiedCount, failed }) => (
          <motion.li layout={reduced ? false : 'position'} key={room.id}>
            <button type="button" className={styles.roomLink} onClick={() => setOpenRoomId(room.id)} aria-haspopup="dialog">
              <span className={styles.fileMark}><Armchair size={20} aria-hidden /></span>
              <span className={styles.fileHeading}><strong>{room.name}</strong>
                <span className={styles.muted}>{failed ? '좌석 조회 실패' : room.hasSeats
                  ? '빈자리 ' + Math.max(0, seats.length - occupiedCount) + '석 · 전체 ' + seats.length + '석'
                  : occupiedCount + '명 신청'}</span>
              </span><ChevronRight size={17} aria-hidden />
            </button>
          </motion.li>))}</ul></LayoutGroup>
        : searchMode === 'room' && !loading && !error && <Notice title="조건에 맞는 자습실이 없어요" />}
    </section>
    <section className={styles.panel}>
      <h2>알림 및 연결</h2>
      <div className={styles.inline}>
        <SelfStudyReminderSettings />
        <Link className={styles.link} href="/study/contribute">학교 연결 기여하기</Link>
      </div>
    </section>
    <dialog ref={ref} aria-labelledby="preview-study-room-dialog" className={styles.roomDialog}
      onCancel={event => { event.preventDefault(); closeRoom(); }}>
      {openRoomData && <>
        <header className={styles.dialogHeader}>
          <h2 id="preview-study-room-dialog">{openRoomData.room.name} {openRoomData.room.hasSeats ? '좌석 배치' : '신청 명단'}</h2>
          <button type="button" className={styles.secondary} aria-label="좌석 창 닫기" autoFocus onClick={closeRoom}><X size={20} aria-hidden /></button>
        </header>
        <div className={styles.dialogBody}>
          {periodSwitch}
          {openRoomData.room.hasSeats && !openRoomData.failed
            ? <>
              <StudySeatBrowser items={seatRows} obstacles={openRoomData.obstacles} width={openRoomData.room.width}
                height={openRoomData.room.height} selectedId={seatId} onSelect={value => setSeatId(String(value.id))} selectOccupied />
              {seat && <div className={styles.inline}>
                {!seat.available ? <p>{seat.seat.name}번 · {seat.detail}</p> :
                  <button type="button" className="pv-primary" disabled={Boolean(error) || loading} onClick={() => {
                    setRequestPrefill({ roomId: openRoomData.room.id, seatId: seat.seat.id, period: selectedPeriod });
                    closeRoom();
                  }}>{seat.seat.name}번 자리 신청</button>}
              </div>}
            </> : <>
              {openRoomData.failed && <Notice title={openRoomData.failedReason || '좌석 배치를 불러오지 못했어요'}>
                <button type="button" className={styles.secondary} onClick={() => void loadData(true)}>다시 불러오기</button>
              </Notice>}
              {roomOccupants.length > 0 ? <ul className="pv-list">{roomOccupants.map(item => <li className={styles.line} key={item.studentId}>
                <span>{item.label}</span><span>{item.status === 'APPROVED' ? '승인됨' : '신청함'}</span>
              </li>)}</ul> : !openRoomData.failed && <p>이 교시에 신청한 학생이 없어요.</p>}
            </>}
        </div>
      </>}
    </dialog>
  </div>;
}
