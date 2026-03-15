'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setStudentId(data.student_id);
        setFullName(data.full_name);
      }
    }
    setLoading(false);
  }

  async function updateProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      student_id: studentId,
      full_name: fullName,
    }).eq('id', user?.id);

    if (error) alert(error.message);
    else alert('프로필이 업데이트되었습니다!');
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-card border border-border rounded-2xl">
      <h2 className="text-2xl font-bold mb-6">프로필 수정</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">이름</label>
          <Input value={fullName} onChange={(e: any) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">학번 (학년/반 변경 시 수정)</label>
          <Input value={studentId} onChange={(e: any) => setStudentId(e.target.value)} />
        </div>
        <Button onClick={updateProfile} className="w-full">정보 저장</Button>
      </div>
    </div>
  );
}