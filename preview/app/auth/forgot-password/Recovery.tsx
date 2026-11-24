'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { authErrorMessage } from '@/lib/authCopy';
import { accountConfigured } from '../../../components/session';
import { Notice } from '../../../components/DirectoryFeedback';
import { AuthSent, canonicalAuthRedirect, currentPreviewReturn, PreviewAuth, previewAuthHref, usePreviewReturn } from '../PreviewAuth';
import styles from '../auth-preview.module.css';

export default function Recovery() {
  const next = usePreviewReturn();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !accountConfigured) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const { supabase } = await import('@/lib/supabase');
      const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: canonicalAuthRedirect('/auth/reset-password', currentPreviewReturn()),
      });
      if (result.error && result.error.code !== 'user_not_found') {
        setError(authErrorMessage(result.error, 'recovery'));
        return;
      }
      setSent(true);
    } catch {
      setError('연결을 확인한 뒤 다시 시도해 주세요. 이메일 주소는 그대로 있어요.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (sent) return <PreviewAuth title="받은편지함을 확인해 주세요">
    <AuthSent email={email.trim()}>가입한 주소라면 비밀번호 재설정 링크를 받을 수 있어요. 메일이 없으면 스팸함도 확인해 주세요.</AuthSent>
    <div className={styles.actions}>
      <Link href={previewAuthHref('/auth/login', next)} className="pv-primary">로그인하기</Link>
      <button type="button" onClick={() => setSent(false)} className={styles.secondary}>이메일 다시 입력</button>
    </div>
  </PreviewAuth>;

  return <PreviewAuth title="비밀번호 찾기" description="가입한 이메일로 비밀번호를 바꿀 수 있는 링크를 받아요."
    footer={<Link href={previewAuthHref('/auth/login', next)}>로그인으로 돌아가기</Link>}>
    {accountConfigured ? <form onSubmit={submit} method="post" aria-busy={busy} aria-describedby={error ? 'preview-recovery-error' : undefined}>
      <label htmlFor="preview-recovery-email">이메일</label>
      <input id="preview-recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none"
        spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} required readOnly={busy} />
      {error && <p className="pv-auth-error" id="preview-recovery-error" role="alert">{error}</p>}
      <button className="pv-primary" type="submit" disabled={busy}>{busy ? '링크 요청 중…' : '재설정 링크 받기'}</button>
    </form> : <Notice title="지금은 비밀번호를 찾을 수 없어요"><a href="/auth/forgot-password">기존 비밀번호 찾기 열기</a></Notice>}
  </PreviewAuth>;
}
