import { Directory, type DirectoryParams } from '../../components/Directory';

export const metadata = { title: '학교 둘러보기' };

export default function Page({ searchParams }: { searchParams: DirectoryParams }) {
  return <Directory kind="schools" searchParams={searchParams} />;
}
