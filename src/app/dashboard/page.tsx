'use client';

import GpuReservationExtension from '@/components/gpu/GpuReservationExtension';
import GpuQueueHint from '@/components/ai/GpuQueueHint';
import { useEffect, useState, useRef, Fragment } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchGpuEndpoints, FALLBACK_GPU_ENDPOINTS, type GpuEndpoint } from '@/lib/gpuEndpoints';
import GPUCard from '@/components/GPUCard';
import WeeklyGPUCard from '@/components/WeeklyGPUCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { RefreshCw, Trash2, Copy, Key, AlertTriangle, StopCircle, Bell, BellOff, Download, Wifi, WifiOff, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ResourceSelection, ResourcePanel, ResourceStatus } from '@/components/ui/resource-motion';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  format, parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const GPU_COLORS: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  1: { bg: 'bg-blue-500/15',    text: 'text-blue-600',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
  2: { bg: 'bg-violet-500/15',  text: 'text-violet-600',  border: 'border-violet-500/30',  dot: 'bg-violet-500' },
  3: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  4: { bg: 'bg-orange-500/15',  text: 'text-orange-600',  border: 'border-orange-500/30',  dot: 'bg-orange-500' },
};
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function Dashboard() {
  const {user}=useAuth();
  return <DashboardSession key={user?.id||'anonymous'}/>;
}

function DashboardSession() {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [gpuPasswords, setGpuPasswords] = useState<{[key: number]: string}>({});
  const [loading, setLoading] = useState(true);
  const [reservationError,setReservationError]=useState('');
  const [reservationRefreshing,setReservationRefreshing]=useState(false);
  const reservationRequest=useRef(0);
  useEffect(()=>()=>{reservationRequest.current++},[]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [pastShown, setPastShown] = useState(5);
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; status: string } | null>(null);
  const [endTarget, setEndTarget] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<GpuEndpoint[]>(FALLBACK_GPU_ENDPOINTS);
  const [gpuStatus, setGpuStatus] = useState<Record<number, 'online'|'offline'|'checking'|'unknown'>>({1:'checking',2:'checking',3:'checking',4:'checking'});
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const statusRequest = useRef(0);
  const [statusCheckedAt, setStatusCheckedAt] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [statsData, setStatsData] = useState<{gpu_id: number; hours: number}[]>([]);

  // ── 캘린더 (구 /schedule 통합) ────────────────────────────────────────────
  const [selectedGpuId, setSelectedGpuId] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarReservations, setCalendarReservations] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [clientToday, setClientToday] = useState<Date | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarLoaded,setCalendarLoaded]=useState(false);
  const [calendarError,setCalendarError]=useState('');
  const [calendarRevision,setCalendarRevision]=useState(0);
  const [extendingIds,setExtendingIds]=useState<string[]>([]);


  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  useEffect(() => { setClientToday(new Date()); }, []);

  // 캘린더에 보이는 달(그리드 범위)만 가져온다 — 예약이 쌓일수록 전체를 매번
  // 긁어오면 느려지고, 어차피 화면엔 이 범위 밖 데이터는 쓰이지 않는다.
  useEffect(() => {
    let current = true;
    const fetchCalendar = async () => {
      setCalendarLoading(true);
      try {
        const { data,error } = await supabase.rpc('get_gpu_reservation_schedule', {
          p_from: gridStart.toISOString(), p_to: gridEnd.toISOString(), p_gpu_id: null,
        });
        if (!current) return;
        if (error || !Array.isArray(data)) throw error || new Error('Invalid reservation schedule');
        setCalendarReservations(data);
        setCalendarLoaded(true);
        setCalendarError('');
      } catch {
        if (current) setCalendarError('예약 현황을 불러오지 못했어요. 기존에 보이는 예약은 최신 정보가 아닐 수 있어요. 다시 불러온 뒤 시간을 확인해 주세요.');
      } finally {
        if (current) setCalendarLoading(false);
      }
    };
    void fetchCalendar();
    return () => { current = false; };
  }, [gridStart.getTime(), gridEnd.getTime(),calendarRevision]);
  const calendarDays: Date[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) calendarDays.push(cursor);

  const getReservationsForDay = (day: Date) => {
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    return calendarReservations.filter(res => {
      const s = parseISO(res.start_time);
      const e = parseISO(res.end_time);
      return s <= dayEnd && e >= dayStart;
    });
  };
  const selectedDayReservations = selectedDay ? getReservationsForDay(selectedDay) : [];

  useEffect(() => { void fetchGpuEndpoints().then(setEndpoints); }, []);

  const gpus = endpoints.map(endpoint => ({
    id: endpoint.gpu_id,
    name: "RTX5000",
    username: `gpu${endpoint.gpu_id}`,
    jupyterhubUrl: endpoint.public_url,
  }));

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  /** 승인된 예약이 있는 GPU의 비밀번호만 가져온다 — get_active_gpu_password RPC가
   * 호출자의 승인된 예약을 서버(DB)에서 직접 확인한 뒤에만 비밀번호를 돌려준다.
   * (supabase_security_hardening_migration.sql 적용 후 gpus 테이블 직접 SELECT는
   * 관리자만 가능하도록 막혀 있어, 전체 GPU 비밀번호가 클라이언트로 내려가지 않는다.) */
  const fetchGpuPasswords = async () => {
    if (!user) { setGpuPasswords({}); return; }
    const { data: myApproved } = await supabase
      .from('reservations')
      .select('gpu_id')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    const gpuIds = [...new Set((myApproved ?? []).map((r: any) => r.gpu_id))];
    if (gpuIds.length === 0) { setGpuPasswords({}); return; }

    const entries = await Promise.all(
      gpuIds.map(async (gpuId) => {
        const { data } = await supabase.rpc('get_active_gpu_password', { p_gpu_id: gpuId });
        return [gpuId, data as string | null] as const;
      })
    );
    const map: {[key: number]: string} = {};
    entries.forEach(([id, password]) => { if (password) map[id] = password; });
    setGpuPasswords(map);
  };

  const fetchMyReservations = async () => {
    if (!user) return;

    const request=++reservationRequest.current;
    setReservationRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if(request!==reservationRequest.current)return;
      if (error || !Array.isArray(data)) throw error || new Error('Invalid reservation list');
      setMyReservations(data);
      setReservationError('');
    } catch {
      if(request!==reservationRequest.current)return;
      setReservationError('내 예약을 불러오지 못했어요. 기존 내역은 그대로 두었어요. 다시 불러와 신청·이용 상태를 확인해 주세요.');
    } finally {
      if(request===reservationRequest.current){setLoading(false);setReservationRefreshing(false);}
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      const { error, count } = await supabase
        .from('reservations')
        .delete({ count: 'exact' })
        .eq('id', cancelTarget.id);

      if (error) throw error;
      if (!count || count === 0) throw new Error("예약 상태가 바뀌었거나 취소 권한이 없어요. 목록을 새로고침해 주세요.");
      showSuccess("예약을 취소했어요.");
      setCancelTarget(null);
      fetchMyReservations();
    } catch (err: any) {
      showError("예약 취소 결과를 확인하지 못했어요. " + err.message);
    }
  };

  const handleEndSession = async () => {
    if (!endTarget) return;
    const { data, error } = await supabase
      .from('reservations')
      .update({ end_time: new Date().toISOString() })
      .eq('id', endTarget)
      .select('id');
    if (error || !data?.length) {
      showError("이용 종료 결과를 확인하지 못했어요. " + (error?.message || '종료할 수 있는 내 예약을 찾지 못했어요.'));
    } else {
      showSuccess("GPU 이용을 종료했어요.");
      setEndTarget(null);
      setSelectedRes(null);
      fetchMyReservations();
    }
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); showSuccess("복사했어요."); }
    catch { showError("복사하지 못했어요. 브라우저에서 클립보드 권한을 확인해 주세요."); }
  };

  // ── GPU 실시간 상태 ──────────────────────────────────────────────────────────
  const checkGpuStatus = async () => {
    const request = ++statusRequest.current;
    setStatusRefreshing(true);
    try {
      const res = await fetch('/api/gpu-status');
      if (!res.ok) throw new Error('GPU status unavailable');
      const data = await res.json();
      if (!Array.isArray(data.gpus)) throw new Error('GPU status unavailable');
      const map: Record<number, 'online'|'offline'|'unknown'> = {1:'unknown',2:'unknown',3:'unknown',4:'unknown'};
      for (const gpu of data.gpus) if ([1,2,3,4].includes(gpu.id) && ['online','offline'].includes(gpu.status)) map[gpu.id]=gpu.status;
      if (request !== statusRequest.current) return;
      setGpuStatus(map);
      setStatusCheckedAt(typeof data.checkedAt==='string'?data.checkedAt:'');
    } catch { if (request === statusRequest.current) { setGpuStatus({1:'unknown',2:'unknown',3:'unknown',4:'unknown'});setStatusCheckedAt(''); } }
    finally { if (request === statusRequest.current) setStatusRefreshing(false); }
  };

  // ── iCal 내보내기 ──────────────────────────────────────────────────────────
  const exportIcal = () => {
    if (!myReservations.length) { showError('아직 예약이 없어요. 먼저 GPU를 예약해 주세요.'); return; }
    const fmtDt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const events = myReservations.map(r => [
      'BEGIN:VEVENT',
      `DTSTART:${fmtDt(r.start_time)}`,
      `DTEND:${fmtDt(r.end_time)}`,
      `SUMMARY:GPU ${r.gpu_id} 예약 — CBGPU`,
      `UID:cbgpu-${r.id}@cbgpu.vercel.app`,
      'END:VEVENT',
    ].join('\r\n')).join('\r\n');
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CBGPU//KO','CALSCALE:GREGORIAN',
      'X-WR-CALNAME:CBGPU 예약','X-WR-TIMEZONE:Asia/Seoul', events,'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    a.download = 'cbgpu-reservations.ics';
    a.click();
    showSuccess('예약 캘린더 파일을 내려받아요.');
  };

  // ── Push 알림 ──────────────────────────────────────────────────────────────
  const requestNotif = async () => {
    if (!('Notification' in window)) { showError('이 브라우저에서는 알림을 사용할 수 없어요.'); return; }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === 'granted') showSuccess('알림을 켰어요. 이 화면을 열어두면 예약 10분 전에 알려드려요.');
    else showError('알림이 차단돼 있어요. 브라우저 설정에서 허용해 주세요.');
  };

  // ── GPU 통계 ───────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await supabase.from('reservations').select('gpu_id, start_time, end_time').gte('start_time', since);
    if (!data) return;
    const map: Record<number, number> = {1:0,2:0,3:0,4:0};
    data.forEach((r: any) => {
      const h = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000;
      if (r.gpu_id >= 1 && r.gpu_id <= 4) map[r.gpu_id] += h;
    });
    setStatsData([1,2,3,4].map(id => ({ gpu_id: id, hours: Math.round(map[id] * 10) / 10 })));
  };

  // push 알림 체크
  useEffect(() => {
    if (!('Notification' in window)) return;
    setNotifPerm(Notification.permission);
    const t = setInterval(() => {
      if (Notification.permission !== 'granted') return;
      myReservations.forEach((r: any) => {
        const start = new Date(r.start_time).getTime();
        const diff = start - Date.now();
        if (diff > 0 && diff < 10 * 60 * 1000) {
          new Notification(`GPU ${r.gpu_id} 예약 시작 10분 전`, {
            body: `${new Date(r.start_time).toLocaleTimeString('ko-KR')} 시작`,
            icon: '/favicon.ico',
          });
        }
      });
    }, 60000);
    return () => clearInterval(t);
  }, [myReservations]);

  useEffect(() => {
    if (user) {
      fetchMyReservations();
      fetchGpuPasswords();
      checkGpuStatus();
      fetchStats();
      const subscription = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchMyReservations())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gpus' }, () => fetchGpuPasswords())
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    } else {
      checkGpuStatus();
    }
  }, [user]);

  // Finished and rejected reservations stay in the history, but only a few show at first so the page does not run on forever.
  const isPastReservation = (r: any) => r.status === 'rejected' || currentTime > new Date(r.end_time);
  const activeReservations = myReservations.filter(r => !isPastReservation(r));
  const pastReservations = myReservations.filter(isPastReservation);
  const shownReservations = [...activeReservations, ...pastReservations.filter((res,index)=>index<pastShown||extendingIds.includes(res.id))];

  return (
    <div className="cb-page-content space-y-12 md:space-y-20 transition-colors duration-500">
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="cb-page-title">GPU</h1><GpuQueueHint/>
            <div className="h-1 w-20 bg-primary rounded-full"></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[1,2,3,4].map(id => {
              const st = gpuStatus[id];
              return (
                <ResourceStatus key={id} value={st||'unknown'} className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-muted rounded-xl border border-border/40">
                  {st === 'online' ? <Wifi className="size-3 text-emerald-600" aria-hidden="true"/> : st === 'offline' ? <WifiOff className="size-3 text-destructive" aria-hidden="true"/> : <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true"/>}
                  <span className="text-sm font-semibold text-muted-foreground">GPU {id} · {st==='checking'?'확인 중':st==='online'?'연결됨':st==='offline'?'연결 끊김':'확인 불가'}</span>
                </ResourceStatus>
              );
            })}
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={checkGpuStatus} disabled={statusRefreshing} aria-label="GPU 연결 상태 새로고침">
              <RefreshCw className={cn("size-4",statusRefreshing&&"animate-spin motion-reduce:animate-none")} />
            </Button>
          </div>
        </div>

        <p className="mb-5 -mt-3 text-sm text-muted-foreground">Jupyter 연결 상태예요. 예약 가능 시간은 아래 달력에서 확인해 주세요.{statusCheckedAt&&Number.isFinite(Date.parse(statusCheckedAt))&&<span className="ml-2">확인 {new Date(statusCheckedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>}</p>
        {/* 전체 GPU 예약 현황 캘린더 — 구 /schedule, 누구나 볼 수 있게 항상 공개 */}
        {calendarError&&<div role="alert" className="mb-4 rounded-xl border border-destructive/30 p-4 text-sm"><p>{calendarError}</p><Button variant="outline" className="mt-3" disabled={calendarLoading} onClick={()=>setCalendarRevision(value=>value+1)}>예약 현황 다시 불러오기</Button></div>}
        {calendarLoading&&calendarLoaded&&<p role="status" className="mb-3 text-sm text-muted-foreground">예약 현황을 갱신하고 있어요.</p>}
        {calendarLoading&&!calendarLoaded ? (
          <div className="py-16 flex items-center justify-center">
            <LoadingSpinner size={56} label="예약 현황 불러오는 중" />
          </div>
        ) : calendarError&&!calendarLoaded ? null : (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="w-full md:flex-1 md:min-w-0 border rounded-2xl overflow-hidden bg-card shadow-sm">
              <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b">
                <Button variant="ghost" size="icon" aria-label="이전 달 예약 보기" onClick={() => {setSelectedDay(null);setCurrentMonth(subMonths(currentMonth, 1))}}>
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CalendarDays className="size-4 opacity-50" />
                  {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                </h2>
                <Button variant="ghost" size="icon" aria-label="다음 달 예약 보기" onClick={() => {setSelectedDay(null);setCurrentMonth(addMonths(currentMonth, 1))}}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b bg-muted/20"><span className="text-sm font-medium text-muted-foreground">예약할 GPU</span><ResourceSelection label="캘린더에서 예약할 GPU 선택" value={String(selectedGpuId)} onChange={value=>setSelectedGpuId(Number(value))} items={[1,2,3,4].map(id=>({value:String(id),label:<span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-1.5 rounded-full',GPU_COLORS[id].dot)}/>#{id}</span>}))}/></div>

              <div className="grid grid-cols-7 border-b">
                {WEEKDAYS.map(d => (
                  <div key={d} className="py-2 text-center text-sm font-semibold text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const dayRes = getReservationsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDay?.toDateString() === day.toDateString();
                  const isTodayDate = clientToday ? isSameDay(day, clientToday) : false;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={cn(
                        'min-h-[56px] md:min-h-[80px] p-1 md:p-2 text-left border-b border-r transition-all',
                        !isCurrentMonth && 'opacity-25',
                        isSelected && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
                        !isSelected && 'hover:bg-muted/30',
                        (i + 1) % 7 === 0 && 'border-r-0',
                      )}
                    >
                      <span className={cn(
                        'text-sm font-semibold inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full mb-1',
                        isTodayDate && 'bg-primary text-primary-foreground',
                        !isTodayDate && isCurrentMonth && 'text-foreground',
                      )}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {dayRes.map((res, j) => {
                          const c = GPU_COLORS[res.gpu_id];
                          return (
                            <Fragment key={j}>
                              <span className={cn('md:hidden size-1.5 rounded-full mt-0.5', c.dot)} />
                              <span className={cn('hidden md:inline text-sm font-semibold px-1.5 py-0.5 rounded-md border', c.bg, c.text, c.border)}>
                                #{res.gpu_id}
                              </span>
                            </Fragment>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={cn(
              'w-full md:w-64 md:shrink-0 border-2 rounded-2xl bg-card shadow-xl transition-all duration-300 overflow-hidden',
              selectedDay ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}>
              {selectedDay && (
                <>
                  <div className="px-5 py-4 border-b">
                    <p className="font-semibold text-sm">
                      {format(selectedDay, 'M월 d일 (eee)', { locale: ko })}
                    </p>
                    <p className="text-sm text-muted-foreground font-bold opacity-70">예약 현황</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedDayReservations.length === 0 ? (
                      <p className="text-muted-foreground font-bold text-sm opacity-50 py-4 text-center">{calendarError?'예약 정보를 다시 확인해 주세요.':'예약 없음'}</p>
                    ) : (
                      selectedDayReservations.map((res) => {
                        const c = GPU_COLORS[res.gpu_id];
                        return (
                          <div key={res.id} className="relative pl-4 pr-3 py-3 rounded-2xl border border-border/40 bg-card overflow-hidden tilt-3d transition-all">
                            <span className={cn('absolute inset-y-0 left-0 w-1', c.dot)} />
                            <div className={cn('text-sm font-semibold mb-1.5', c.text)}>GPU #{res.gpu_id}</div>
                            <div className="text-sm font-bold space-y-0.5 text-foreground">
                              <p>예약됨</p>
                              <p className="opacity-40 text-sm">
                                {format(parseISO(res.start_time), 'M/d')} – {format(parseISO(res.end_time), 'M/d')}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <hr className="border-border transition-colors duration-500" />

      {/* 예약하기 + My Reservations를 나란히 — 박스 그리드 대신 하나씩 집중해서 예약하고,
          넓은 화면의 가로 공간을 살려 예약 폼 옆에서 바로 내 예약 현황을 확인한다 */}
      <section className="lg:flex lg:gap-10 lg:items-start pb-20">
        <div className="lg:w-[420px] lg:shrink-0 space-y-6 mb-10 lg:mb-0">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">예약하기</h2>
            <p className="text-sm text-muted-foreground font-bold">GPU와 이용 시간을 선택해 예약을 신청해 주세요.</p>
          </div>
          <ResourceSelection label="GPU 예약 선택"
            items={[1,2,3,4].map(id => ({ value: String(id), label: `GPU #${id}` }))}
            value={String(selectedGpuId)}
            onChange={(v) => setSelectedGpuId(Number(v))}
          />
          <ResourcePanel value={selectedGpuId}>
            {selectedGpuId === 1
              ? <GPUCard key={1} id={1} name="RTX5000" />
              : <WeeklyGPUCard key={selectedGpuId} id={selectedGpuId} name="RTX5000" />}
          </ResourcePanel>
        </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[30vh] text-center space-y-4">
          <h2 className="text-2xl font-semibold">로그인 후 예약해 주세요</h2>
          <p className="text-muted-foreground">로그인하면 신청한 예약과 이용 상태를 확인할 수 있어요.</p>
        </div>
      ) : (
      <div id="my-gpu-reservations" className="flex-1 min-w-0 scroll-mt-24">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">내 예약</h2>
            <p className="text-sm text-muted-foreground font-bold">사용 중인 예약을 확인하고 관리해요</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportIcal} className="font-semibold text-sm gap-1.5 h-8">
              <Download className="size-3" /> iCal
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={notifPerm === 'granted' ? undefined : requestNotif}
              className={`font-semibold text-sm gap-1.5 h-8 ${notifPerm === 'granted' ? 'text-green-500 border-green-500/30' : ''}`}
            >
              {notifPerm === 'granted' ? <Bell className="size-3" /> : <BellOff className="size-3" />}
              {notifPerm === 'granted' ? '알림 ON' : '알림 설정'}
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchMyReservations} disabled={reservationRefreshing} aria-label="내 예약 다시 불러오기" className="hover:bg-primary/10 font-bold text-sm gap-2 h-8">
              <RefreshCw className="size-3" />
              <span className="hidden sm:inline">새로고침</span>
            </Button>
          </div>
        </div>

        {/* GPU 점유율 통계 */}
        {statsData.length > 0 && (
          <div className="mb-8 p-4 bg-muted/20 border border-border/40 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground">GPU 점유율 (최근 30일)</p>
              <Button variant="ghost" size="icon" className="size-6" onClick={fetchStats}><RefreshCw className="size-2.5" /></Button>
            </div>
            <div className="space-y-2">
              {statsData.map(s => {
                const max = Math.max(...statsData.map(d => d.hours), 1);
                const pct = max > 0 ? (s.hours / max) * 100 : 0;
                return (
                  <div key={s.gpu_id} className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-muted-foreground w-10 shrink-0">GPU {s.gpu_id}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground w-12 text-right shrink-0">{s.hours}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reservationError&&<div role="alert" className="mb-4 rounded-xl border border-destructive/30 p-4 text-sm"><p>{reservationError}</p><Button variant="outline" className="mt-3" disabled={reservationRefreshing} onClick={()=>void fetchMyReservations()}>내 예약 다시 확인</Button></div>}
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <LoadingSpinner size={56} label="예약 내역 불러오는 중" />
          </div>
        ) : reservationError&&myReservations.length===0 ? null : myReservations.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-2xl text-muted-foreground transition-colors duration-500 font-medium bg-muted/10 pop-in-3d">
            <p style={{ fontFamily: 'Tossface', fontSize: 64, lineHeight: 1 }} className="mb-3">💻</p>
            아직 신청한 예약이 없어요.
          </div>
        ) : (
          <>
          <div className="grid gap-4 md:gap-6">
            {shownReservations.map((res) => {
              const start = new Date(res.start_time);
              const end = new Date(res.end_time);
              const isStarted = currentTime >= start;
              const isEnded = currentTime > end;
              const isApproved = res.status === 'approved';
              const isRejected = res.status === 'rejected';
              const isPending = res.status === 'pending';
              const canStart = isApproved && isStarted && !isEnded;

              const gpuInfo = gpus.find(g => g.id === res.gpu_id);
              const password = gpuPasswords[res.gpu_id];

              return (
                <div key={res.id} className="group flex flex-col p-5 md:p-6 border rounded-2xl bg-card shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-500">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
                    <div className="space-y-2 mb-4 md:mb-0 w-full md:w-auto">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg md:text-xl font-bold text-primary">GPU #{res.gpu_id}</span>
                        {isPending && <Badge variant="warning">승인 대기</Badge>}
                        {isRejected && <Badge variant="danger">거절됨</Badge>}
                        {isApproved && !isStarted && <Badge variant="default">이용 예정</Badge>}
                        {isApproved && isStarted && !isEnded && <Badge variant="success">이용 중</Badge>}
                        {isApproved && isEnded && <Badge variant="muted">종료됨</Badge>}
                      </div>
                      <p className="text-sm md:text-sm text-muted-foreground font-bold bg-muted/50 inline-block px-2 py-1 rounded-md">
                        {start.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-2 opacity-30">→</span>
                        {end.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      {(isApproved||extendingIds.includes(res.id))&&<GpuReservationExtension available={canStart} onInteractionChange={active=>setExtendingIds(previous=>active?[...new Set([...previous,res.id])]:previous.filter(id=>id!==res.id))} reservationId={res.id} apiBase={'/api/compute/legacy/reservations/'+res.id} onExtended={end=>{setMyReservations(previous=>previous.map(item=>item.id===res.id?{...item,end_time:end}:item));setSelectedRes((previous:Record<string,unknown>|null)=>previous?.id===res.id?{...previous,end_time:end}:previous);setCalendarRevision(value=>value+1);void fetchMyReservations()}}/>}
                      {(isPending || (isApproved && !isStarted)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancelTarget({ id: res.id, status: res.status })}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                      <Button
                        className="flex-grow md:flex-grow-0 min-w-[140px] md:min-w-[180px] font-semibold px-8 transition-all duration-300 text-sm h-11 gap-2"
                        variant={canStart ? "default" : "secondary"}
                        disabled={!canStart}
                        onClick={() => setSelectedRes(selectedRes?.id === res.id ? null : res)}
                      >
                        {isRejected ? "예약 거절됨" : isApproved && !isStarted ? "이용 시간 전" : isApproved && isEnded ? "이용 종료됨" : isApproved ? (selectedRes?.id === res.id ? "접속 안내 닫기" : "접속 안내 보기") : "승인 대기 중"}
                      </Button>
                    </div>
                  </div>

                  {/* Credentials & Guide Panel */}
                  {selectedRes?.id === res.id && canStart && (
                    <div className="mt-6 p-6 bg-muted/30 border border-dashed border-primary/20 rounded-2xl animate-in slide-in-from-top-4 duration-500">
                      <div className="space-y-4">
                        <h3 className="flex items-center gap-2 font-semibold text-primary">
                          <Key className="size-4" /> 접속 정보
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="flex flex-col gap-4 rounded-2xl border bg-background p-4">
                            <div>
                              <span className="text-sm font-semibold opacity-70">접속 비밀번호</span>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <code className={password ? "min-w-0 truncate text-lg font-bold text-blue-500" : "text-sm font-bold text-muted-foreground animate-pulse"}>
                                  {password || "비밀번호 준비 중..."}
                                </code>
                                {password && (
                                  <Button variant="ghost" size="icon" aria-label="비밀번호 복사" onClick={() => copyToClipboard(password)} className="h-8 w-8 shrink-0 hover:bg-primary/10">
                                    <Copy className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              예약 시간에만 사용할 수 있어요.
                            </p>
                            {gpuInfo?.jupyterhubUrl && (
                              <Button
                                asChild
                                className="mt-auto w-full font-semibold text-sm h-11 border hover:bg-foreground hover:text-background transition-all"
                                variant="outline"
                              >
                                <a href={gpuInfo.jupyterhubUrl} target="_blank" rel="noopener noreferrer">
                                  Jupyter Notebook 열기
                                </a>
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-col gap-4 rounded-2xl border bg-background p-4">
                            <div>
                              <span className="text-sm font-semibold opacity-70">SSH</span>
                              <div className="flex items-center gap-2 mt-1 rounded-lg border bg-muted/30 pl-3 pr-1 min-h-11">
                                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm font-bold" title={`ssh cbgpu-gpu${res.gpu_id}`}>
                                  ssh cbgpu-gpu{res.gpu_id}
                                </code>
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`ssh cbgpu-gpu${res.gpu_id}`)} className="h-9 shrink-0 gap-1.5 px-2 text-sm font-bold" aria-label="SSH 명령어 복사">
                                  <Copy className="size-3.5" /> 복사
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              최초 1회 SSH 설정 · 예약 시간에 이용 · <Link href="/dashboard/ssh-guide" className="text-primary underline underline-offset-2">사용법</Link>
                            </p>
                            <Button asChild variant="outline" className="mt-auto w-full h-11 border text-sm font-semibold">
                              <Link href="/profile#gpu-ssh-key">SSH 공개키 등록</Link>
                            </Button>
                          </div>
                        </div>
                        <Button
                          className="w-full font-semibold text-sm h-11 gap-2"
                          variant="destructive"
                          onClick={() => setEndTarget(res.id)}
                        >
                          <StopCircle className="size-4" /> 사용 중단
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {pastReservations.length > 5 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">지난 예약 {Math.min(pastShown, pastReservations.length)} / {pastReservations.length}개 표시 중</p>
              {pastShown < pastReservations.length && <Button variant="outline" className="min-h-11" onClick={() => setPastShown(n => n + 10)}>지난 예약 더 보기</Button>}
              {pastShown > 5 && <Button variant="ghost" className="min-h-11" onClick={() => setPastShown(5)}>접기</Button>}
            </div>
          )}
          </>
        )}
      </div>
      )}
      </section>

      <Dialog open={!!endTarget} onOpenChange={(open) => { if (!open) setEndTarget(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-semibold">
              <StopCircle className="size-5 text-destructive" />
              사용 중단
            </DialogTitle>
            <DialogDescription className="text-sm font-bold pt-1">
              GPU 이용을 종료할까요? 컨테이너가 초기화되고 작업 내용이 삭제돼요. 필요한 파일을 먼저 내려받아 주세요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-semibold text-sm" onClick={() => setEndTarget(null)}>
              돌아가기
            </Button>
            <Button variant="destructive" className="font-semibold text-sm" onClick={handleEndSession}>
              종료하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-5 text-destructive" />
              예약 취소
            </DialogTitle>
            <DialogDescription className="text-sm font-bold pt-1">
              {cancelTarget?.status === 'approved'
                ? "이미 승인된 예약이에요. 예약을 취소할까요?"
                : "예약을 취소하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-semibold text-sm" onClick={() => setCancelTarget(null)}>
              돌아가기
            </Button>
            <Button variant="destructive" className="font-semibold text-sm" onClick={handleCancel}>
              취소하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
