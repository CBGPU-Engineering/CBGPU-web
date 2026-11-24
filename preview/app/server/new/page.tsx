import CreateServerProject from '@/app/server/new/page';
import { ComputeWorkspace } from '../../../components/ComputeWorkspace';

export const metadata = { title: '새 서버 프로젝트' };

export default function Page() {
  return <ComputeWorkspace tool="server" title="새 서버 프로젝트" detail><CreateServerProject /></ComputeWorkspace>;
}
