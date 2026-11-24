import type { Metadata } from 'next';
import CliGuide from '@/components/ai/CliGuide';

export const metadata: Metadata = {
  title: 'CBGPU CLI 코딩 도구',
  description: 'OpenCode 기반 코딩 도구를 내 터미널에서 CBGPU AI에 연결하세요.',
};

export default function AgentInstallPage() {
  return (
    <div className="px-4 py-8 sm:px-8">
      <CliGuide />
    </div>
  );
}
