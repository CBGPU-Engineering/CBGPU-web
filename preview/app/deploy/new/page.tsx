import DeployConsole from '@/components/deploy/DeployConsole';
import { ComputeWorkspace } from '../../../components/ComputeWorkspace';

export const metadata = { title: '새 프론트엔드 프로젝트' };

export default function Page() {
  return <ComputeWorkspace tool="deploy" title="새 프론트엔드 프로젝트" detail><DeployConsole preview view="new" /></ComputeWorkspace>;
}
