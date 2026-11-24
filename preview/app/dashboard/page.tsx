import Dashboard from '@/app/dashboard/page';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: 'GPU 예약' };

export default function Page() {
  return <ComputeWorkspace tool="gpu"><Dashboard /></ComputeWorkspace>;
}
