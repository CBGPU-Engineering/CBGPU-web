import StudioOpen from '@/app/server/[id]/open/page';
import { ComputeWorkspace } from '../../../../components/ComputeWorkspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'TeacherStudio 연결', referrer: 'no-referrer' as const };

export default function Page(props: Parameters<typeof StudioOpen>[0]) {
  return <ComputeWorkspace tool="server" title="TeacherStudio 연결" detail><StudioOpen {...props} /></ComputeWorkspace>;
}
