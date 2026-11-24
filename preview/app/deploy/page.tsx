import DeployConsole from '@/components/deploy/DeployConsole';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: '프론트엔드 배포' };

export default function Page() {
  return <ComputeWorkspace tool="deploy"><DeployConsole preview /></ComputeWorkspace>;
}
