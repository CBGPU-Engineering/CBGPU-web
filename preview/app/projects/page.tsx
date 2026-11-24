import { CollaborationAction } from '../../components/CollaborationWorkspace';
import { Directory, type DirectoryParams } from '../../components/Directory';

export const metadata = { title: '공개 프로젝트' };

export default function Page({ searchParams }: { searchParams: DirectoryParams }) {
  return <Directory kind="projects" searchParams={searchParams} toolbar={<CollaborationAction href="/projects/manage">내 프로젝트</CollaborationAction>} />;
}
