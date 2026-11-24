'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { getURL } from '@/lib/utils';
import { previewReturn } from '../../components/session';
import styles from './auth-preview.module.css';

export function currentPreviewReturn() {
  return previewReturn(new URLSearchParams(window.location.search).get('next'));
}

export function usePreviewReturn() {
  const [next, setNext] = useState('/new/');
  useEffect(() => { setNext(currentPreviewReturn()); }, []);
  return next;
}

export function previewAuthHref(path: '/auth/login' | '/auth/signup' | '/auth/forgot-password', next: string) {
  return path + '?next=' + encodeURIComponent(next);
}

export function canonicalAuthRedirect(path: '/auth/callback' | '/auth/reset-password', next: string) {
  const target = new URL(path, getURL());
  target.searchParams.set('next', next);
  return target.toString();
}

export function PreviewAuth({ title, description, footer, children }: {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const heading = useId();
  return <section className="pv-page pv-auth-page" aria-labelledby={heading}>
    <Link className="pv-back" href="/"><ArrowLeft size={17} aria-hidden />홈으로</Link>
    <div className="pv-auth">
      <h1 id={heading}>{title}</h1>
      {description && <p>{description}</p>}
      {children}
      {footer && <div className="pv-auth-links">{footer}</div>}
    </div>
  </section>;
}

export function PasswordField({ value, onChange, busy }: {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return <div className={styles.field}>
    <label htmlFor={id}>비밀번호</label>
    <div className="pv-password">
      <input id={id} name="password" value={value} onChange={event => onChange(event.target.value)}
        type={visible ? 'text' : 'password'} minLength={6} autoComplete="new-password"
        aria-describedby={id + '-note'} readOnly={busy} required />
      <button type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
      </button>
    </div>
    <small id={id + '-note'}>6자 이상 입력해 주세요.</small>
  </div>;
}

export function AuthSent({ email, children }: { email: string; children: ReactNode }) {
  return <div className={styles.sent} role="status">
    <CheckCircle2 size={25} aria-hidden />
    <div><strong>{email}</strong><p>{children}</p></div>
  </div>;
}
