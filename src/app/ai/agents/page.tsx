import type { Metadata } from 'next';
import PersonalAgentGuide from '@/components/ai/PersonalAgentGuide';

export const metadata: Metadata = {
  title: '개인 에이전트 설치 | CBGPU AI',
  description: 'OpenClaw와 Hermes를 내 컴퓨터에 설치하거나 Linux 서버용 설치 프롬프트를 만드세요.',
};

export default function PersonalAgentsPage() {
  return <div className="px-4 py-8 sm:px-8"><PersonalAgentGuide /></div>;
}
