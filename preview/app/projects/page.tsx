import { Directory, type DirectoryParams } from '../../components/Directory';

export const metadata = { title: '공개 프로젝트' };

export default function Page({ searchParams }: { searchParams: DirectoryParams }) {
  return <Directory kind="projects" searchParams={searchParams} />;
}
