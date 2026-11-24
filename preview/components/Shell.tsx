'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, UserRound } from 'lucide-react';
import { MotionConfig, LayoutGroup, motion } from 'motion/react';
import { Suspense, type ReactNode } from 'react';
import { PreviewIdentity, usePreviewIdentity } from './PreviewIdentity';
import { navigation } from './navigation';
import { QuickSearch } from './QuickSearch';

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const entries = mobile ? navigation.filter(entry => entry.href !== '/projects' && entry.href !== '/docs') : navigation;

  return (
    <LayoutGroup id={mobile ? 'dock' : 'sidebar'}>
      {entries.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === href : pathname === href || pathname.startsWith(href + '/');
        return (
          <Link key={href} href={href} className="pv-nav-item" aria-current={active ? 'page' : undefined}>
            {active && <motion.span aria-hidden="true" className="pv-nav-selection" layoutId="selection" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </LayoutGroup>
  );
}

function Logo() {
  return (
    <Link href="/" aria-label="CBGPU 홈" className="pv-logo">
      {/* The original wordmarks are small vector brand assets. */}
      <img className="pv-logo-light" src="/new/brand/horizontal_black.svg" width="118" height="25" alt="" />
      <img className="pv-logo-dark" src="/new/brand/horizontal_white.svg" width="118" height="25" alt="" />
    </Link>
  );
}

function Account({ pathname }: { pathname: string }) {
  const { signedIn } = usePreviewIdentity();
  const parameters = useSearchParams();
  const path = pathname.startsWith('/auth/') ? '/' : pathname;
  const next = '/new' + path + (parameters.size && path !== '/' ? '?' + parameters : '');
  return signedIn
    ? <Link href="/profile" className="pv-account"><UserRound size={18} aria-hidden="true" /> 내 계정</Link>
    : <Link href={'/auth/login?next=' + encodeURIComponent(next)} className="pv-account"><UserRound size={18} aria-hidden="true" /> 로그인</Link>;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <PreviewIdentity>
      <a href="#preview-content" className="pv-skip">본문으로 건너뛰기</a>
      <div className="pv-shell">
        <aside className="pv-rail">
          <Logo />
          <nav aria-label="주 탐색"><Navigation /></nav>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- The existing app is a separate Next.js zone. */}
          <a className="pv-legacy" href="/"><ArrowDownLeft size={16} aria-hidden="true" /> 기존 CBGPU</a>
        </aside>
        <div className="pv-column">
          <header className="pv-top">
            <Logo />
            <QuickSearch />
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- This control leaves the preview zone. */}
            <a className="pv-top-return" href="/"><ArrowDownLeft size={16} aria-hidden="true" /> 기존 화면</a>
            <Suspense fallback={<Link href="/auth/login" className="pv-account">로그인</Link>}><Account pathname={pathname} /></Suspense>
          </header>
          <main id="preview-content" className="pv-content" tabIndex={-1}>{children}</main>
        </div>
        <nav className="pv-dock" aria-label="모바일 탐색"><Navigation mobile /></nav>
      </div>
      </PreviewIdentity>
    </MotionConfig>
  );
}
