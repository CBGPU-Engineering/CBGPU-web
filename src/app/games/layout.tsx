import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '아케이드',
  description: 'AI 학습 대기 중에 즐길 수 있는 클래식 게임들.',
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
