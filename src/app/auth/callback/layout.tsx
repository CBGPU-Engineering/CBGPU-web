import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: '로그인 확인' };

export default function AuthStepLayout({ children }: { children: ReactNode }) {
  return children;
}
