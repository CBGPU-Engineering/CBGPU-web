import { CollaborationAction } from '../../../components/CollaborationWorkspace';
import { Detail } from '../../../components/Directory';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Detail kind="projects" id={id} actions={<CollaborationAction href={'/projects/manage/publication'}>내 프로젝트 소개하기</CollaborationAction>} />;
}
