'use client';

import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { authErrorMessage } from '@/lib/authCopy';
import { accountConfigured, previewReturn } from '../../../components/session';
import { Notice } from '../../../components/DirectoryFeedback';

export default function Login() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !accountConfigured) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    setBusy(true);
    setError('');
    try {
      const { supabase } = await import('@/lib/supabase');
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setError(authErrorMessage(result.error, 'login'));
        return;
      }
      window.location.replace(previewReturn(new URLSearchParams(window.location.search).get('next')));
    } catch {
      setError('연결을 확인한 뒤 다시 로그인해 주세요. 입력한 내용은 그대로 두었어요.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="pv-page pv-auth-page">
    <Link className="pv-back" href="/"><ArrowLeft size={17} aria-hidden="true" /> 홈으로</Link>
    <div className="pv-auth">
      <h1>로그인</h1>
      <p>사용하던 CBGPU 계정으로 로그인해요.</p>
      {!accountConfigured ? <Notice title="이 환경에서는 로그인할 수 없어요">
        <a href="/auth/login">기존 CBGPU에서 로그인</a>
      </Notice> : <form method="post" onSubmit={submit} aria-busy={busy} aria-describedby={error ? 'preview-login-error' : undefined}>
        <label htmlFor="preview-login-email">이메일</label>
        <input id="preview-login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} readOnly={busy} required />
        <label htmlFor="preview-password">비밀번호</label>
        <div className="pv-password">
          <input id="preview-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" readOnly={busy} required />
          <button type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </div>
        {error && <p className="pv-auth-error" id="preview-login-error" role="alert">{error}</p>}
        <button className="pv-primary" type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인하기'}</button>
      </form>}
      <div className="pv-auth-links"><a href="/auth/signup">계정 만들기</a><a href="/auth/forgot-password">비밀번호 찾기</a></div>
    </div>
  </section>;
}
