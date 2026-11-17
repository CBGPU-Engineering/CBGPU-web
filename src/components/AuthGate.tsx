'use client';
import Link from 'next/link';
import{isPublicBrowsingPath}from'@/lib/publicPaths';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { LoadingSpinner } from './ui/spinner';

const PUBLIC_PATHS = ['/', '/services', '/contact', '/download', '/privacy'];

function isPublicPath(pathname: string) {
  // Every auth flow must be reachable before a normal signed-in session
  // exists. This includes forgot/reset password and any future callback page.
  // Sensitive actions still require the recovery session enforced by
  // Supabase; this only allows the page itself to render.
  return (process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'&&isPublicBrowsingPath(pathname)) || (process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'&&pathname==='/schools') || PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/auth/') || pathname === '/docs' || pathname.startsWith('/docs/') || pathname === '/arxiv' || pathname.startsWith('/arxiv/');
}

export default function AuthGate({ children, publicSite = false,workspaceSite=false }: { children: React.ReactNode; publicSite?: boolean;workspaceSite?:boolean }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isPublic = publicSite || (workspaceSite&&(pathname==='/'||pathname==='/workspace')) || isPublicPath(pathname);
  const blocked = !isLoading && !user && !isPublic;

  // 공개 경로(로그인/회원가입 포함)는 auth 체크를 기다릴 필요가 전혀 없다 — 바로 렌더
  if (isPublic) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} />
      </div>
    );
  }

  if(blocked&&process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'&&/^\/contests(?:\/[a-f0-9-]{36})?$/.test(pathname)){const destination=pathname==='/contests'?'/explore/contests':'/explore'+pathname;return <section className="cb-public-page"><header className="cb-public-page-heading"><h1>공개 대회를 먼저 둘러보세요</h1><p>공개 소개와 일정은 로그인 없이 볼 수 있어요. 내 참가 내역과 신청·제출은 계정 확인 후 직접 진행해요.</p></header><div className="flex flex-wrap gap-3"><Link href={destination} className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold">공개 대회 보기</Link><Link href={'/auth/login?next='+encodeURIComponent(pathname)} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">로그인하고 내 대회 확인</Link></div></section>}
  if (blocked) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-6 pop-in-3d">
        <div className="flex items-center justify-center size-24 mx-auto rounded-full bg-primary/10">
          <span style={{ fontFamily: 'Tossface', fontSize: 56, lineHeight: 1 }}>🔒</span>
        </div>
        <div className="space-y-1.5">
          <p className="text-xl font-semibold tracking-tight">로그인이 필요해요</p>
          <p className="text-sm text-muted-foreground font-medium">이 페이지는 로그인 후 이용할 수 있어요</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={`/auth/login?next=${encodeURIComponent(pathname)}`}
            className="rounded-2xl bg-primary text-primary-foreground py-3.5 font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            로그인
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-2xl bg-card ring-1 ring-foreground/5 py-3.5 font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            회원가입
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
