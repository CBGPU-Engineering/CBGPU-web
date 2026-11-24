import { CollaborationAction } from '../../components/CollaborationWorkspace';
import { Directory, type DirectoryParams } from '../../components/Directory';

export const metadata = { title: '공개 대회' };

export default function Page({ searchParams }: { searchParams: DirectoryParams }) {
  return <Directory kind="contests" searchParams={searchParams} toolbar={<CollaborationAction href="/contests/workspace">참가·운영 대회</CollaborationAction>} />;
}
