import { ContestDetailPage } from '../../../../components/CollaborationFeatures';
import { publicPath } from '@/lib/publicContentModel';
import { notFound } from 'next/navigation';
import { CollaborationWorkspace } from '../../../../components/CollaborationWorkspace';

export const metadata = { title: '대회 관리' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!publicPath(['contests', id])) notFound();
  return <CollaborationWorkspace path={`/contests/${id}/manage`} backHref="/contests" backLabel="공개 대회"
    title="대회 관리" description="운영진 계정으로 로그인해 참가 신청과 제출물을 관리할 수 있어요.">
    <ContestDetailPage previewWorkspace managementRoute />
  </CollaborationWorkspace>;
}
