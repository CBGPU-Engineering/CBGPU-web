import { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: '로그인', template: '%s | CBGPU' },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
