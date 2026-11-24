'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, LogIn } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { accountConfigured, previewReturn } from './session';
import './collaboration.css';

const AccountWorkspace = dynamic(() => import('./CollaborationAccess'), {
  ssr: false,
  loading: () => <p className="pv-page" role="status">로그인 상태를 확인하고 있어요.</p>,
});

export type WorkspaceProps = {
  children: ReactNode;
  path: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
};

function LoginLink({ path }: { path: string }) {
  const params = useSearchParams();
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  const returnTo = previewReturn('/new' + path + (params.size ? '?' + params.toString() : '') + hash);
  return <Link className="pv-primary" prefetch={false} href={'/auth/login?next=' + encodeURIComponent(returnTo)}>
    <LogIn size={17} aria-hidden="true" /> 로그인하기
  </Link>;
}

export function SignInNotice({ path, title, description, backHref, backLabel }: Omit<WorkspaceProps, 'children'>) {
  return <section className="pv-page pv-collaboration-gate">
    <Link className="pv-back" href={backHref}><ArrowLeft size={17} aria-hidden="true" /> {backLabel}</Link>
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
    {accountConfigured ? <Suspense fallback={<p role="status">로그인 링크를 준비하고 있어요.</p>}><LoginLink path={path} /></Suspense>
      : <p role="status">현재 미리보기에서는 계정에 연결할 수 없어요.</p>}
  </section>;
}

export function CollaborationWorkspace(props: WorkspaceProps) {
  if (!accountConfigured) return <SignInNotice {...props} />;
  return <AccountWorkspace {...props} />;
}

export function CollaborationAction({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="pv-primary pv-collaboration-action" prefetch={false} href={href}>{children} <ArrowRight size={16} aria-hidden="true" /></Link>;
}
