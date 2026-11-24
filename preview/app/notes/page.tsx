import NotesPage from '@/app/notes/page';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: '연구노트' };

export default function Page() {
  return <ComputeWorkspace tool="notes"><NotesPage /></ComputeWorkspace>;
}
