import { ContestDetailPage } from '../../../../components/CollaborationFeatures';
import { publicPath } from '@/lib/publicContentModel';
import { notFound } from 'next/navigation';
import { CollaborationWorkspace } from '../../../../components/CollaborationWorkspace';

export const metadata = { title: '대회 참가' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!publicPath(['contests', id])) notFound();
  return <CollaborationWorkspace path={`/contests/${id}/participate`} backHref="/contests" backLabel="공개 대회"
    title="대회 참가" description="참가 조건을 확인하고, 내 신청과 제출물을 관리하려면 로그인해 주세요.">
    <ContestDetailPage previewWorkspace />
  </CollaborationWorkspace>;
}
