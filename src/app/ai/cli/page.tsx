import type { Metadata } from 'next';
import CliGuide from '@/components/ai/CliGuide';

export const metadata: Metadata = {
  title: 'CBGPU 에이전트 설치',
  description: '내 컴퓨터에 OpenClaw 또는 Hermes Agent를 설치하고 CBGPU에 연결하세요.',
};

export default function AgentInstallPage() {
  return (
    <main id="main-content" className="px-4 py-8 sm:px-8">
      <CliGuide />
    </main>
  );
}
