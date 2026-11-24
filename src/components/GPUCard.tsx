'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import {useSchoolResourcePermission} from '@/components/schools/SchoolResourceScope';
import { Badge } from '@/components/ui/badge';
import { SuccessFeedback } from '@/components/ui/product-motion';
import { format, isSameDay, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TimePicker } from '@/components/ui/time-picker';
import { Zap } from 'lucide-react';

const DURATION_PRESETS = [
  { label: '1시간', hours: 1 },
  { label: '3시간', hours: 3 },
  { label: '6시간', hours: 6 },
  { label: '12시간', hours: 12 },
  { label: '1일', hours: 24 },
  { label: '2일', hours: 48 },
  { label: '3일', hours: 72 },
  { label: '7일', hours: 168 },
];
const NEXT_14_DAYS = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));

/** A couple minutes of slack so "지금 바로 시작" doesn't immediately fail the
 * start-must-be-in-the-future check by the time the request actually submits. */
function nowPlusBuffer(): Date {
  return new Date(Date.now() + 2 * 60000);
}

function combineDateTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export default function GPUCard({ id, name }: { id: number; name: string }) {
  const sharedGpu = id === 1 && process.env.NEXT_PUBLIC_CBGPU_SHARE_RESERVED_GPU_ONE === '1';
  const { showAlert, showError } = useAlert();
  const { isApproved } = useAuth();
  const gpuPermission=useSchoolResourcePermission('gpu',isApproved);
  const requestInProgress=useRef(false);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selectedTime, setSelectedTime] = useState(() => format(nowPlusBuffer(), 'HH:mm'));
  const [durationHours, setDurationHours] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedRequest, setCompletedRequest] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);

  const start = combineDateTime(selectedDate, selectedTime);
  const end = new Date(start.getTime() + durationHours * 3600000);

  const startNow = () => {
    const target = nowPlusBuffer();
    setSelectedDate(startOfDay(target));
    setSelectedTime(format(target, 'HH:mm'));
  };

  useEffect(() => {
    fetchApprovedReservations();
  }, [id]);

  const fetchApprovedReservations = async () => {
    const now = new Date();
    const { data, error } = await supabase.rpc('get_gpu_booking_schedule', {
      p_from: now.toISOString(), p_to: new Date(now.getTime() + 90 * 86400000).toISOString(), p_gpu_id: id,
    });

    if (!error) {
      setApprovedReservations(data || []);
    }
  };

  const handleRequest = async () => {
    if(requestInProgress.current)return;
    requestInProgress.current=true;setIsSubmitting(true);
    try{await submitRequest()}finally{requestInProgress.current=false;setIsSubmitting(false)}
  };
  const submitRequest = async () => {
    setCompletedRequest('');
    if (!await gpuPermission.verify()) {
      showError(gpuPermission.enabled?gpuPermission.reason:'이름과 학번을 확인해야 예약할 수 있어요. 프로필에서 정보를 확인해 주세요.'); return;
    }

    if (showSchedule) {
      setShowSchedule(false);
      showAlert('예약 시간을 확인해 주세요.', 'info'); return;
    }

    if (start <= new Date()) {
      showError('현재 시간보다 늦은 시작 시각을 선택해 주세요.'); return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showError('로그인한 뒤 다시 신청해 주세요.'); return; }

    setIsSubmitting(true);

    try {
      const { data: existingReservations, error: checkError } = await supabase.rpc('get_gpu_booking_schedule', {
        p_from: start.toISOString(), p_to: end.toISOString(), p_gpu_id: id,
      });

      if (checkError) throw checkError;

      const hasConflict = existingReservations?.some((res: { start_time: string; end_time: string }) => {
        const resStart = new Date(res.start_time);
        const resEnd = new Date(res.end_time);
        return (start < resEnd && end > resStart);
      });

      if (hasConflict) {
        setIsSubmitting(false);
        showError('선택한 시간에 대기 중이거나 승인된 예약이 있어요. 다른 시간을 선택해 주세요.'); return;
      }

      const { error } = await supabase
        .from('reservations')
        .insert({
            gpu_id: id,
            user_id: user.id,
            user_email: user.email,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'pending'
        });

      if (error) throw error;

      setCompletedRequest(`${format(start,'M월 d일 HH:mm')}부터 ${durationHours}시간 · 내 예약에서 처리 상태를 확인해 주세요.`);
      setDurationHours(3);
      fetchApprovedReservations();
    } catch (error: any) {
      console.error('Reservation Error:', error);
      showError(error?.code === '23P01' ? '선택한 시간에 대기 중이거나 승인된 GPU 예약이 있어요. 다른 시간을 선택해 주세요.' : '예약 신청 결과를 확인하지 못했어요. 내 예약에서 상태를 확인한 뒤 다시 신청해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  
  const getReservationsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    return approvedReservations.filter(res => {
      const resStart = parseISO(res.start_time);
      const resEnd = parseISO(res.end_time);
      return resStart <= dayEnd && resEnd >= dayStart;
    });
  };

  return (
    <Card className="overflow-hidden border-border bg-card group shadow-sm flex flex-col h-full rounded-2xl">
      <CardHeader className="p-0 overflow-hidden relative">
        <div className="relative w-full h-32">
          <Image
            src="/img/rtx5000.jpg"
            alt="GPU"
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
        </div>
        <div className="absolute top-2 right-2">
            <Button 
                variant="secondary" 
                size="xs" 
                className="text-xs font-semibold h-6 bg-background/80 backdrop-blur-sm shadow-sm"
                aria-expanded={showSchedule} aria-label={showSchedule?`GPU ${id} 예약 입력으로 돌아가기`:`GPU ${id} 예약 일정 보기`} onClick={() => setShowSchedule(!showSchedule)}
            >
                {showSchedule ? "예약 현황 닫기" : "예약 현황 보기"}
            </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4 flex-grow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">GPU #{id}</h3>
            <p className="text-xs text-muted-foreground font-semibold">{name}</p>
          </div>
          <div className="flex flex-col items-end">
            <Badge variant="muted">시간 단위 예약</Badge>
          </div>
        </div>

        {sharedGpu && <div id="gpu-one-shared-use" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold">AI와 함께 쓰는 GPU예요</p>
          <p className="mt-1 text-muted-foreground">네 장이 모두 예약되면 AI가 GPU 1번을 함께 써요. 작업이 느려지거나 GPU 메모리가 부족할 수 있어요.</p>
        </div>}

        {showSchedule ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="max-h-60 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {next7Days.map((day, idx) => {
                const dayReservations = getReservationsForDay(day);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {format(day, 'MMM d (eee)', { locale: ko })}
                      </span>
                      <div className="h-[1px] flex-grow bg-border/50"></div>
                    </div>
                    {dayReservations.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 pl-2">예약이 없어요</p>
                    ) : (
                      dayReservations.map((res, i) => {
                        const s = parseISO(res.start_time);
                        const e = parseISO(res.end_time);
                        const isStart = isSameDay(s, day);
                        const isEnd = isSameDay(e, day);
                        
                        return (
                          <div key={i} className="text-xs p-2 bg-muted/30 rounded-lg border border-border/30 hover:bg-muted/50 transition-colors">
                            <div className="flex justify-between font-bold text-foreground">
                              <span>
                                {isStart ? format(s, 'HH:mm') : '00:00'} - {isEnd ? format(e, 'HH:mm') : '23:59'}
                              </span>
                              {!isStart && !isEnd && <span className="text-xs bg-primary/20 text-primary px-1 rounded">종일</span>}
                              <span className="text-xs text-muted-foreground opacity-70">예약됨</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground ml-1">사용 시작일</label>
              <div className="flex gap-1.5 overflow-x-auto py-1.5 -mx-1 px-1">
                {NEXT_14_DAYS.map((day, i) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const dayHasReservation = approvedReservations.some((res) => {
                    const s = parseISO(res.start_time);
                    const e = parseISO(res.end_time);
                    return s <= endOfDay(day) && e >= startOfDay(day);
                  });
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`flex flex-col items-center gap-0.5 shrink-0 px-2.5 py-1.5 rounded-lg border text-center transition-all active:scale-95 ${
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                      }`}
                    >
                      <span className="text-xs font-bold opacity-70">{i === 0 ? '오늘' : i === 1 ? '내일' : format(day, 'eee', { locale: ko })}</span>
                      <span className="text-xs font-semibold">{format(day, 'M/d')}</span>
                      <span className={`size-1 rounded-full ${dayHasReservation ? (isSelected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground ml-1">시작 시각</label>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={startNow}
                  className="flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-semibold transition-all active:scale-95 hover:bg-primary/20"
                >
                  <Zap className="size-3.5" /> 지금 바로 시작
                </button>
                <TimePicker value={selectedTime} onChange={setSelectedTime} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground ml-1">사용 시간 <span className="text-primary/60 normal-case">(최대 7일)</span></label>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setDurationHours(p.hours)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${ durationHours === p.hours ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30' }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 rounded-2xl py-2 px-3">
              <span>{format(start, 'M/d(eee) HH:mm', { locale: ko })}</span>
              <span className="opacity-40">→</span>
              <span>{format(end, 'M/d(eee) HH:mm', { locale: ko })}</span>
            </div>
          </div>
        )}
      </CardContent>

      {completedRequest&&<div className="px-4 pb-4"><SuccessFeedback compact title="예약 신청을 보냈어요" description={completedRequest}><a href="#my-gpu-reservations" className="text-sm font-semibold text-primary">내 예약에서 처리 상태 확인하기</a></SuccessFeedback></div>}
      <CardFooter className="p-4 pt-0">
        <Button 
          onClick={handleRequest}
          aria-describedby={sharedGpu ? "gpu-one-shared-use" : undefined}
          disabled={isSubmitting||!gpuPermission.allowed}
          className="w-full font-bold py-5 transition-all active:scale-95 text-xs"
        >
          {isSubmitting ? '신청 중...' : '예약 신청하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
