'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAlert } from '@/lib/alert';
import { getURL } from '@/lib/utils';
import { MailCheck } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { showError } = useAlert();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getURL() + 'auth/reset-password',
      });
      if (error) {
        showError('요청 실패: ' + error.message);
        return;
      }
      setSent(true);
    } catch {
      showError('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-2xl shadow-lg text-center space-y-4">
        <MailCheck className="size-12 mx-auto text-primary" />
        <h1 className="cb-page-title">이메일을 확인해주세요</h1>
        <p className="text-sm text-muted-foreground font-medium">
          <span className="font-bold text-foreground">{email}</span>로 비밀번호 재설정 링크를 보냈습니다.
        </p>
        <Link href="/auth/login" className="inline-block text-primary font-bold hover:underline text-sm">로그인으로 이동</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-2xl shadow-lg">
      <h1 className="cb-page-title mb-2 text-center">비밀번호 찾기</h1>
      <p className="text-sm text-muted-foreground text-center font-medium mb-6">가입한 이메일로 재설정 링크를 보내드립니다.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-foreground">Email</label>
          <Input
            type="email"
            placeholder="이메일 주소를 입력하세요"
            className="h-12 rounded-lg border-border bg-background px-3.5 text-[15px] font-medium text-foreground dark:bg-background"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button
          disabled={isSubmitting}
          className="w-full bg-primary h-12 text-sm font-semibold transition-all active:scale-95"
        >
          {isSubmitting ? "전송 중..." : "재설정 링크 받기"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
        <Link href="/auth/login" className="text-primary font-bold hover:underline">로그인으로 돌아가기</Link>
      </p>
    </div>
  );
}
