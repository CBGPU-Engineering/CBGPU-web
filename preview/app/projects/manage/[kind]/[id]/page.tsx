import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectTeam } from '../../../../../components/CollaborationFeatures';
import { notFound } from 'next/navigation';
import { publicPath } from '@/lib/publicContentModel';
import { CollaborationWorkspace } from '../../../../../components/CollaborationWorkspace';

export const metadata = { title: '프로젝트 공동작업자' };

export default async function Page({ params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if ((kind !== 'frontend' && kind !== 'server') || !publicPath(['projects', id])) notFound();
  return <CollaborationWorkspace path={`/projects/manage/${kind}/${id}`} backHref="/projects/manage" backLabel="내 프로젝트"
    title="프로젝트 공동작업자" description="내가 접근할 수 있는 프로젝트의 공동작업자를 확인하려면 로그인해 주세요.">
    <header className="pv-collaboration-heading">
      <div><Link className="pv-back" href="/projects/manage"><ArrowLeft size={17} aria-hidden="true" /> 내 프로젝트</Link><h1>프로젝트 공동작업자</h1>
        <p>이 프로젝트에 접근할 수 있는 사람과 각 역할을 확인해요.</p></div>
    </header>
    <ProjectTeam id={id} kind={kind} />
  </CollaborationWorkspace>;
}
