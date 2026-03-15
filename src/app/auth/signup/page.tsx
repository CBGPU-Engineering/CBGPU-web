'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const router = useRouter();

  const handleSignup = async (e: any) => {
    e.preventDefault();
    
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
    });

    if (error) return alert("회원가입 에러: " + error.message);

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          { 
            id: data.user.id, 
            student_id: studentId, 
            full_name: fullName,
            is_admin: false,
            is_approved: false
          }
        ]);

      if (profileError) {
        console.error(profileError);
        alert("프로필 생성 실패: " + profileError.message);
      } else {
        alert('회원가입 성공! 관리자 승인을 기다려주세요.');
        router.push('/auth/login');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-card border border-border rounded-2xl shadow-xl transition-colors duration-500">
      <h2 className="text-3xl font-bold mb-6 text-center text-foreground uppercase tracking-tighter italic">CBGPU 가입</h2>
      <form onSubmit={handleSignup} className="space-y-4">
        <Input 
          placeholder="실명" 
          className="bg-background border-input text-foreground"
          onChange={(e: any) => setFullName(e.target.value)} 
          required 
        />
        <Input 
          placeholder="학번 (예: 30101)" 
          className="bg-background border-input text-foreground"
          onChange={(e: any) => setStudentId(e.target.value)} 
          required 
        />
        <Input 
          type="email" 
          placeholder="이메일" 
          className="bg-background border-input text-foreground"
          onChange={(e: any) => setEmail(e.target.value)} 
          required 
        />
        <Input 
          type="password" 
          placeholder="비밀번호" 
          className="bg-background border-input text-foreground"
          onChange={(e: any) => setPassword(e.target.value)} 
          required 
        />
        <Button className="w-full bg-primary py-6 text-lg font-bold text-primary-foreground hover:bg-primary/90">
          가입하기
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요? <Link href="/auth/login" className="text-primary font-bold hover:underline">로그인</Link>
      </p>
    </div>
  );
}