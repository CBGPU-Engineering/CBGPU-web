import type { Metadata } from 'next';
import ResetEntry from './ResetEntry';

export const metadata: Metadata = { title: '비밀번호 재설정' };

export default function Page() {
  return <ResetEntry />;
}
