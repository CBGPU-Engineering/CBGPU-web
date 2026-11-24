import { ComputeSchoolEntry } from './ComputeSchoolEntry';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: '학교 GPU' };

export default function Page() {
  return <ComputeWorkspace tool="gpu"><ComputeSchoolEntry /></ComputeWorkspace>;
}
