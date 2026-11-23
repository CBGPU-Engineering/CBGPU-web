import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: '로그인 연결' };

export default function AuthStepLayout({ children }: { children: ReactNode }) {
  return children;
}
