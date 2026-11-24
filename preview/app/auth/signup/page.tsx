import type { Metadata } from 'next';
import SignupEntry from './SignupEntry';

export const metadata: Metadata = { title: '계정 만들기' };

export default function Page() {
  return <SignupEntry />;
}
