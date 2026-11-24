'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { SchoolScopeProvider } from '@/components/schools/SchoolScope';
import { Notice } from './DirectoryFeedback';

function Session({ path, children }: { path: string; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if (!user) return (
    <Notice title="로그인한 뒤 계속할 수 있어요">
      <Link href={'/auth/login?next=' + encodeURIComponent('/new' + path)}>로그인</Link>
    </Notice>
  );
  return <SchoolScopeProvider key={user.id}>{children}</SchoolScopeProvider>;
}

export default function SchoolOpsAccount({ path, children }: { path: string; children: ReactNode }) {
  return <AuthProvider><Session path={path}>{children}</Session></AuthProvider>;
}
