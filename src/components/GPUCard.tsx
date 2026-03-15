'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function GPUCard({ id, name }: { id: number; name: string }) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!startTime || !endTime) {
      return alert('시작 시간과 종료 시간을 모두 선택해 주세요.');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return alert('종료 시간은 시작 시간보다 늦어야 합니다.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('로그인이 필요합니다.');

    setIsSubmitting(true);

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

    setIsSubmitting(false);

    if (error) {
      console.error('Reservation Error:', error);
      alert('예약 실패: ' + error.message);
    } else {
      alert(`Unit #${id} 예약 신청이 완료되었습니다!`);
      setStartTime('');
      setEndTime('');
    }
  };

  return (
    <Card className="overflow-hidden border-border bg-card hover:border-primary transition-all group shadow-lg">
      <CardHeader className="p-0 overflow-hidden">
        <img 
          src="/img/rtx5000.jpg" 
          alt="GPU" 
          className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" 
        />
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-xl font-bold">Unit #{id}</h3>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">사용 시작</label>
            <Input 
              type="datetime-local" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-background cursor-pointer focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">사용 종료</label>
            <Input 
              type="datetime-local" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="bg-background cursor-pointer focus:ring-primary"
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0">
        <Button 
          onClick={handleRequest} 
          disabled={isSubmitting}
          className="w-full font-bold py-6 transition-all active:scale-95"
        >
          {isSubmitting ? '신청 중...' : '예약 신청하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}