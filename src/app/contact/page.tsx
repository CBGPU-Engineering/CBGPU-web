'use client';
import KakaoPageAd from '@/components/ads/KakaoPageAd';
import { useRef, useState } from 'react';
import { boundedClientRequest } from '@/lib/boundedClientRequest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['예약 문의', '계정 문제', '기술 지원', '기타'];

export default function ContactPage() {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [form, setForm] = useState({
    name: profile?.full_name || '',
    email: user?.email || '',
    category: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!form.name || !form.email || !form.message) {
      showError('이름, 이메일, 문의 내용을 입력해 주세요.'); return;
    }
    submitting.current = true;
    const submitted = { ...form };
    setIsSubmitting(true);
    try {
      await boundedClientRequest(async signal => {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitted),
        signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok !== true) throw new Error('Contact delivery unconfirmed');
      }, undefined, 30_000);
      showSuccess('문의를 보냈어요. 입력한 이메일로 답변을 안내해요.');
      setForm(prev => prev.name === submitted.name && prev.email === submitted.email && prev.category === submitted.category && prev.message === submitted.message
        ? { ...prev, category: '', message: '' } : prev);
    } catch {
      showError('문의 전송 결과를 확인하지 못했어요. 입력한 내용은 그대로 있어요. 다시 보내면 중복 접수될 수 있어요.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="cb-page-title flex items-center gap-3">
          <MessageSquare className="size-6" /> 문의하기
        </h1>
        <p className="cb-page-sub mt-1">
          문의 내용을 남겨 주세요. 답변은 입력한 이메일로 안내해요.
        </p>
      </div>

      <KakaoPageAd placement="platform" contentReady/>
      <form onSubmit={handleSubmit} className="space-y-5 border border-border rounded-2xl p-5 sm:p-6 bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-name" className="text-sm font-semibold text-muted-foreground">이름 *</label>
            <Input
              id="contact-name"
              autoComplete="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="홍길동"
              className="h-11 font-normal text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-email" className="text-sm font-semibold text-muted-foreground">이메일 *</label>
            <Input
              id="contact-email"
              autoComplete="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="답변받을 이메일을 입력해 주세요"
              className="h-11 font-normal text-base"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-muted-foreground">분류</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                aria-pressed={form.category === cat}
                onClick={() => setForm(prev => ({ ...prev, category: prev.category === cat ? '' : cat }))}
                className={cn(
                  'min-h-11 text-sm font-medium px-3 py-2 rounded-lg border transition-colors',
                  form.category === cat
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-message" className="text-sm font-semibold text-muted-foreground">내용 *</label>
          <textarea
            id="contact-message"
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="어떤 화면에서 무슨 일이 있었는지 알려 주세요. 비밀번호나 인증 토큰은 적지 마세요."
            rows={6}
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base font-normal resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 font-semibold text-xs gap-2 active:scale-95 transition-all"
        >
          <Send className="size-4" />
          {isSubmitting ? '전송 중...' : '문의 보내기'}
        </Button>
      </form>
    </div>
  );
}
