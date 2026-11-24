'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowRight, Cpu, FlaskConical, Layers3, LockKeyhole, Sparkles } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { useAuth } from '@/lib/useAuth';
import FeatureProviders from './FeatureProviders';
import SchoolResourceBoundary from '@/components/schools/SchoolResourceBoundary';
import './ComputeWorkspace.css';

type Tool = 'ai' | 'gpu' | 'deploy' | 'server' | 'notes' | 'latex';

const tools = {
  ai: { name: 'CBGPU AI', description: '질문하고, 자료를 읽고, 다음 작업을 시작해 보세요.', Icon: Sparkles },
  gpu: { name: '학교 GPU', description: '이용 가능한 자원을 확인하고 예약 시간에 작업을 시작하세요.', Icon: Cpu },
  deploy: { name: '프론트엔드 배포', description: 'Git 저장소를 연결하고 사이트의 배포 상태를 관리하세요.', Icon: Layers3 },
  server: { name: '서버 배포', description: '서버 프로젝트의 배포와 공개 주소를 관리하세요.', Icon: Layers3 },
  notes: { name: '연구노트', description: '실험 과정과 아이디어를 기록하고 동료와 공유하세요.', Icon: FlaskConical },
  latex: { name: 'LaTeX', description: '논문을 작성하거나 ZIP으로 보관한 프로젝트를 가져오세요.', Icon: FlaskConical },
} satisfies Record<Tool, { name: string; description: string; Icon: typeof Cpu }>;

const workspaces = {
  deployment: { label: '배포 도구', links: [{ href: '/deploy', label: '프론트엔드' }, { href: '/server', label: '서버' }] },
  research: { label: '연구 도구', links: [{ href: '/notes', label: '연구노트' }, { href: '/latex', label: 'LaTeX' }] },
} as const;

function SignInAction() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const returnTo = '/new' + pathname + (query ? '?' + query : '');
  return <Link className="pv-primary" href={'/auth/login?next=' + encodeURIComponent(returnTo)}>로그인하기 <ArrowRight size={16} aria-hidden="true" /></Link>;
}

function WorkbenchAccess({ tool, children }: { tool: Tool; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status" className="pv-compute-feedback">로그인 상태를 확인하고 있어요.</p>;
  if (!user) return (
    <section className="pv-compute-feedback" aria-labelledby="compute-sign-in">
      <LockKeyhole size={24} aria-hidden="true" />
      <h2 id="compute-sign-in">로그인하고 {tools[tool].name} 이용하기</h2>
      <p>로그인하면 이 화면으로 돌아와요.</p>
      <Suspense fallback={null}><SignInAction /></Suspense>
    </section>
  );
  return <SchoolResourceBoundary>{children}</SchoolResourceBoundary>;
}

export function ComputeWorkspace({ tool, children, title, detail = false }: { tool: Tool; children: ReactNode; title?: string; detail?: boolean }) {
  const pathname = usePathname();
  const { name, description, Icon } = tools[tool];
  const workspace = tool === 'deploy' || tool === 'server' ? workspaces.deployment : tool === 'notes' || tool === 'latex' ? workspaces.research : null;
  return (
    <div className={'pv-compute pv-compute-' + tool + (detail ? ' pv-compute-detail' : '')}>
      <header className="pv-compute-header">
        <div className="pv-compute-headings">
          <span className="pv-compute-icon"><Icon size={24} strokeWidth={1.7} aria-hidden="true" /></span>
          <div><h1>{title || name}</h1>{!detail && <p>{description}</p>}</div>
        </div>
        {workspace && <nav className="pv-compute-switch" aria-label={workspace.label}>
          {workspace.links.map(({ href, label }) => <Link href={href} aria-current={pathname === href || pathname.startsWith(href + '/') ? 'page' : undefined} key={href}>{label}</Link>)}
        </nav>}
      </header>
      <FeatureProviders><WorkbenchAccess tool={tool}>{children}</WorkbenchAccess></FeatureProviders>
    </div>
  );
}
