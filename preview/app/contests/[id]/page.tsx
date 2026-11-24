import { CollaborationAction } from '../../../components/CollaborationWorkspace';
import { Detail } from '../../../components/Directory';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Detail kind="contests" id={id} actions={<CollaborationAction href={'/contests/' + encodeURIComponent(id) + '/participate'}>참가 안내와 제출물</CollaborationAction>} />;
}
