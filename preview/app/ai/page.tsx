import { Suspense } from 'react';
import AiWorkspace from '@/components/ai/AiWorkspace';
import { ComputeChatIntro } from '../../components/ComputeChatIntro';
import { ComputeWorkspace } from '../../components/ComputeWorkspace';

export const metadata = { title: 'CBGPU AI' };

export default function Page() {
  return <ComputeWorkspace tool="ai"><Suspense fallback={<p role="status">대화를 불러오고 있어요.</p>}><AiWorkspace previewIntro={<ComputeChatIntro />} /></Suspense></ComputeWorkspace>;
}
