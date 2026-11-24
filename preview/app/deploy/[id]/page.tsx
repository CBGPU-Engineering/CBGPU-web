import DeployConsole from '@/components/deploy/DeployConsole';
import { ComputeWorkspace } from '../../../components/ComputeWorkspace';

export const metadata = { title: '프론트엔드 프로젝트' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComputeWorkspace tool="deploy" title="프론트엔드 프로젝트" detail><DeployConsole preview projectId={id} view="detail" /></ComputeWorkspace>;
}
