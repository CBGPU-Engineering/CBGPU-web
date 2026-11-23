import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: '회원가입' };

export default function AuthStepLayout({ children }: { children: ReactNode }) {
  return children;
}
