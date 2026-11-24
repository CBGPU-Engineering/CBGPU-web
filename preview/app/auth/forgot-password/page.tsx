import type { Metadata } from 'next';
import Recovery from './Recovery';

export const metadata: Metadata = { title: '비밀번호 찾기' };

export default function Page() {
  return <Recovery />;
}
