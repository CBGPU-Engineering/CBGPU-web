import ServerProject from '@/app/server/[id]/page';
import { ComputeWorkspace } from '../../../components/ComputeWorkspace';

export const metadata = { title: '서버 프로젝트' };

export default function Page() {
  return <ComputeWorkspace tool="server" title="서버 프로젝트" detail><ServerProject /></ComputeWorkspace>;
}
