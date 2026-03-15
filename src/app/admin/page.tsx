'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error || !data?.is_admin) {
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
        fetchReservations();
      }
    };

    checkAdmin();
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
    
    if (error) {
        console.error("Data Load Error:", error);
        toast.error("데이터 로드 실패");
    } else {
        setReservations(data || []);
    }
  }

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending') {
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
        toast.error("변경 실패: " + error.message);
    } else {
        toast.success("상태가 변경되었습니다.");
        fetchReservations();
    }
  }

  if (isAdmin === null) {
    return <div className="flex items-center justify-center min-h-[50vh]">권한 확인 중...</div>;
  }

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="bg-destructive/10 p-6 rounded-full">
          <svg className="w-16 h-16 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-4xl font-black tracking-tighter italic uppercase">Access Denied</h1>
        <p className="text-muted-foreground text-lg max-w-md font-medium">
          이 페이지에 접근할 권한이 없습니다. 어드민 계정으로 로그인해 주세요.
        </p>
        <Button onClick={() => router.push('/')} variant="outline" className="font-bold px-8">홈으로 돌아가기</Button>
      </div>
    );
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
                    <TableCell className="font-medium">GPU #{res.gpu_id}</TableCell>
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