import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Shell } from '../components/Shell';
import './preview.css';

const pretendard = localFont({
  src: '../../src/app/fonts/PretendardVariable.woff2',
  weight: '45 920',
  display: 'swap',
  variable: '--preview-font',
});

export const metadata: Metadata = {
  title: { default: 'CBGPU', template: '%s · CBGPU' },
  description: '학교생활부터 프로젝트, 대회, 커뮤니티까지.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" storageKey="cbgpu-preview-theme" defaultTheme="system" enableSystem>
          <Shell>{children}</Shell>
        </ThemeProvider>
      </body>
    </html>
  );
}
