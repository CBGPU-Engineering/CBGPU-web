import { Directory, type DirectoryParams } from '../../components/Directory';

export const metadata = { title: '공개 커뮤니티' };

export default function Page({ searchParams }: { searchParams: DirectoryParams }) {
  return <Directory kind="community" searchParams={searchParams} />;
}
