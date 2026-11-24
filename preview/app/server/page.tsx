import ServerProjects from '@/app/server/page';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: '서버 배포' };

export default function Page() {
  return <ComputeWorkspace tool="server"><ServerProjects /></ComputeWorkspace>;
}
