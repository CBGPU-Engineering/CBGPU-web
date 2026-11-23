import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문의하기',
  alternates: { canonical: '/contact' },
  description: 'GPU 예약, 계정과 서비스 이용 중 궁금한 점을 남겨 주세요. 입력한 이메일로 답변을 안내해요.',
  openGraph: {
    url: 'https://cbgpu.com/contact',
    title: '문의하기 | CBGPU',
    description: 'GPU 예약, 계정과 서비스 이용 중 궁금한 점을 남겨 주세요.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
