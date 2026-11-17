import {ProductExperienceProvider} from '@/components/ui/product-motion';
import AdIdentityBoundary from '@/components/ads/AdIdentityBoundary';
import AppUpdateNotice from '@/components/AppUpdateNotice';
import DemoBanner from '@/components/DemoBanner';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import SiteTraffic from '@/components/SiteTraffic';
import './globals.css';

// Pretendard를 직접 싣는다. 폰트 스택에 이름만 있고 로드하는 곳이 없으면 기기에 설치된 글꼴로 제각각 그려지고,
// system-ui가 고정폭 글꼴인 환경에서는 사이트 전체가 고정폭으로 보인다. (SIL OFL 1.1 — fonts/PRETENDARD-OFL.txt)
const pretendard = localFont({ src: './fonts/PretendardVariable.woff2', variable: '--font-pretendard', weight: '45 920', display: 'swap', fallback: ['Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Segoe UI', 'Roboto', 'sans-serif'] });
import AdminShell from '@/components/AdminShell';
import ScopedSchoolAdminShell from '@/components/schools/ScopedSchoolAdminShell';
import {SchoolScopeProvider} from '@/components/schools/SchoolScope';
import SchoolResourceBoundary from '@/components/schools/SchoolResourceBoundary';
import PublicShell from '@/components/public-browsing/PublicShell';
import{isPublicBrowsingPath}from'@/lib/publicPaths';
import{publicDetail}from'@/lib/publicContentServer';
import{notFound}from'next/navigation';
import ManufacturingShell from '@/components/manufacturing/ManufacturingShell';
import MainSiteFrame from '@/components/workspaces/MainSiteFrame';
import WorkspaceShell from '@/components/workspaces/WorkspaceShell';
import {isWorkspace,workspaceForHost} from '@/lib/workspaces';
import AuthGate from '@/components/AuthGate';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/useAuth';
import { Metadata,Viewport } from 'next';
import { AlertProvider } from '@/lib/alert';
import DeferredStylesheet from '@/components/DeferredStylesheet';
import ApprovalNotice from '@/components/ApprovalNotice';
import ReturnToApp from '@/components/ReturnToApp';
import SiteBanner from '@/components/SiteBanner';

export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content'};

const siteUrl = 'https://cbgpu.com';
const schoolLogo = '/brand/v1/icon_light_512.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  title: {
    default: 'CBGPU | 학교생활·연구·개발을 하나로',
    template: '%s | CBGPU',
  },
  description: '충북과학고등학교 학생을 위한 올인원 플랫폼. GPU 대여, 자습신청, 시간표, 급식, 투표, 연구노트, 스터디 매칭까지 학교생활에 필요한 모든 것.',
  keywords: ['충북과학고', '충북과학고등학교', 'CBGPU', '학생 플랫폼', 'GPU 대여', '자습신청', '시간표', '급식', '스터디 매칭', 'AI 학습'],
  authors: [{ name: 'CBGPU', url: siteUrl }],
  creator: 'CBGPU',
  publisher: '충북과학고등학교',
  verification: {
    google: 'sQMtTP1fRlurHqsuva_YpLUcIBbClWVp2eFWOwxP2K4',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: 'CBGPU',
    title: 'CBGPU | 학교생활·연구·개발을 하나로',
    description: '충북과학고등학교 학생을 위한 올인원 플랫폼. GPU 대여, 자습신청, 시간표, 급식, 투표, 연구노트, 스터디 매칭까지.',
    images: [{ url: schoolLogo, width: 512, height: 512, alt: 'CBGPU 로고' }],
  },
  twitter: {
    card: 'summary',
    title: 'CBGPU | 학교생활·연구·개발을 하나로',
    description: '충북과학고등학교 학생을 위한 올인원 플랫폼.',
    images: [schoolLogo],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [{url:'/brand/v1/favicon.ico',type:'image/x-icon'},{url:'/brand/v1/icon_light_192.png',sizes:'192x192',type:'image/png'}],
    shortcut: '/brand/v1/favicon.ico',
    apple: '/brand/v1/icon_light_180.png',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CBGPU',
  url: siteUrl,
  description: '학교생활, 연구와 개발을 연결하는 CBGPU 작업 공간',
  publisher: {
    '@type': 'EducationalOrganization',
    name: '충북과학고등학교',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-cbgpu-public-host')||requestHeaders.get('host')?.split(':')[0];
  const section = requestHeaders.get('x-cbgpu-site');
  const workspace=workspaceForHost(host||'');
  const savedMode=requestHeaders.get('x-cbgpu-mode');
  const appSite=host==='app.cbgpu.com'||requestHeaders.get('x-cbgpu-app')==='1';

  // Resolve anonymous detail existence before the inherited loading boundary can stream a 200.
  if(process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'){const path=requestHeaders.get('x-cbgpu-path')||'',match=path.match(/^\/(projects|explore\/contests|explore\/schools)\/([^/]+)$/);if(match){const kind=match[1]==='projects'?'projects':match[1]==='explore/contests'?'contests':'schools',result=await publicDetail(kind,match[2]);if(result.ok&&!result.data.item||!result.ok&&result.status===404)notFound();}}
  const publicBrowsingPage=process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'&&isPublicBrowsingPath(requestHeaders.get('x-cbgpu-path')||'');
  const sessionHint=/(?:^|;)\s*sb-cbgpu-auth-token(?:\.\d+)?=/.test(requestHeaders.get('cookie')||'');
  const schoolAdminPage=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'&&/^\/schools\/[A-Za-z0-9_-]{1,100}\/admin$/.test(requestHeaders.get('x-cbgpu-path')||'');
  const adminSite = host === 'admin.cbgpu.com';
  const appWebView=/;\s*wv\)/.test(requestHeaders.get('user-agent')||'');
  const manufacturingSite=['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(host||'');
  // The equipment gateway (portal) adds this header only while its separate login is in front of the site (never trust it elsewhere).
  const portalGate = adminSite || (manufacturingSite && requestHeaders.get('x-cbgpu-portal-gate') === '1');
  const publicSite = section === 'docs' || section === 'arxiv' || host === 'docs.cbgpu.com' || host === 'arxiv.cbgpu.com';

  return (
    <html lang={adminSite||schoolAdminPage||manufacturingSite ? "en" : "ko"} className={pretendard.variable} suppressHydrationWarning>
      <head>
        {portalGate&&<script dangerouslySetInnerHTML={{ __html: 'window.__CBGPU_PORTAL_GATE=true' }} />}
        {process.env.CBGPU_DEMO!=='1'&&<link rel="preconnect" href="https://cdn.jsdelivr.net" />}
        {process.env.CBGPU_DEMO!=='1'&&<DeferredStylesheet href="https://cdn.jsdelivr.net/gh/toss/tossface/dist/tossface.css" />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">본문으로 건너뛰기</a>
        <ThemeProvider
          attribute="class"
          storageKey={adminSite||schoolAdminPage||manufacturingSite?"cbgpu-developer-theme":"theme"}
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {process.env.CBGPU_DEMO==='1'&&<DemoBanner/>}
          <AuthProvider siteHost={host || undefined} portalGate={portalGate}>
            <AdIdentityBoundary><SchoolScopeProvider><ProductExperienceProvider><AlertProvider english={adminSite||schoolAdminPage||manufacturingSite}>
              {schoolAdminPage ? <ScopedSchoolAdminShell><AuthGate>{children}</AuthGate></ScopedSchoolAdminShell> : manufacturingSite ? <ManufacturingShell equipmentKind={host==='laser.cbgpu.com'?'laser':'print'} appWebView={appWebView}>{children}</ManufacturingShell> : adminSite ? <AdminShell appWebView={appWebView}><AuthGate>{children}</AuthGate></AdminShell> : publicSite ? <AuthGate publicSite>{children}</AuthGate> : publicBrowsingPage ? <PublicShell workspace={workspace||(isWorkspace(savedMode)?savedMode:'student')} isApp={appSite} sessionHint={sessionHint}><AuthGate workspaceSite>{children}</AuthGate></PublicShell> : workspace||appSite||host==='cbgpu.com'||host==='www.cbgpu.com' ? <WorkspaceShell workspace={workspace||(isWorkspace(savedMode)?savedMode:'student')} isApp={appSite}><SiteBanner/><ApprovalNotice/><AuthGate workspaceSite><SchoolResourceBoundary>{children}</SchoolResourceBoundary></AuthGate></WorkspaceShell> : <MainSiteFrame>{children}</MainSiteFrame>}
              {appSite&&<AppUpdateNotice/>}
              {(adminSite||manufacturingSite)&&<ReturnToApp/>}
              {!adminSite && !manufacturingSite && <SiteTraffic />}
            </AlertProvider></ProductExperienceProvider></SchoolScopeProvider></AdIdentityBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
