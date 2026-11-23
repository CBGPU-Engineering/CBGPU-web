import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: '비밀번호 재설정' };

export default function AuthStepLayout({ children }: { children: ReactNode }) {
  return children;
}
