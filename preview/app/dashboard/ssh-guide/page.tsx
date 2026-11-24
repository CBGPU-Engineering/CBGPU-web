import SshGuide from '@/app/dashboard/ssh-guide/page';
import { ComputeWorkspace } from '../../../components/ComputeWorkspace';

export const metadata = { title: 'SSH 연결 가이드' };

export default function Page() {
  return <ComputeWorkspace tool="gpu" title="SSH 연결 가이드" detail><SshGuide /></ComputeWorkspace>;
}
