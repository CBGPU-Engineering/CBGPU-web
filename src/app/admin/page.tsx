'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminPage() {
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    fetchReservations();
  }, []);

  async function fetchReservations() {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:user_id (
          full_name,
          student_id
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Data Load Error:", error);
    else setReservations(data || []);
  }

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending') {
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) alert("변경 실패: " + error.message);
    else fetchReservations();
  }

  return (
    <div className="space-y-10 p-4">
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tighter">GPU 예약 관리</h1>
          <p className="text-sm text-muted-foreground">학생들의 예약 신청을 검토하고 승인/거절하세요.</p>
        </div>

        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>신청자 (학번/이름)</TableHead>
                <TableHead>GPU</TableHead>
                <TableHead>예약 기간</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10">신청 내역이 없습니다.</TableCell></TableRow>
              ) : (
                reservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{res.profiles?.full_name || '알 수 없음'}</span>
                        <span className="text-xs text-muted-foreground">{res.profiles?.student_id || res.user_email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">Unit #{res.gpu_id}</TableCell>
                    <TableCell className="text-[11px] leading-tight">
                      {new Date(res.start_time).toLocaleString('ko-KR')} <br/>
                      ~ {new Date(res.end_time).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      {res.status === 'pending' && <span className="text-amber-500 font-black text-xs border border-amber-500/20 bg-amber-500/10 px-2 py-1 rounded">대기</span>}
                      {res.status === 'approved' && <span className="text-emerald-500 font-black text-xs border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded">승인됨</span>}
                      {res.status === 'rejected' && <span className="text-red-500 font-black text-xs border border-red-500/20 bg-red-500/10 px-2 py-1 rounded">거절됨</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {res.status === 'pending' ? (
                          <>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => updateStatus(res.id, 'approved')}>승인</Button>
                            <Button size="sm" variant="destructive" className="font-bold" onClick={() => updateStatus(res.id, 'rejected')}>거절</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => updateStatus(res.id, 'pending')}>되돌리기</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}