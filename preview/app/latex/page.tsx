import LatexPage from '@/app/latex/page';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: 'LaTeX' };

export default function Page() {
  return <ComputeWorkspace tool="latex"><LatexPage /></ComputeWorkspace>;
}
