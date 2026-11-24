'use client';

import dynamic from 'next/dynamic';
import { accountConfigured } from '../../../components/session';
import { Notice } from '../../../components/DirectoryFeedback';
import { PreviewAuth } from '../PreviewAuth';

const Signup = dynamic(() => import('./Signup'), {
  ssr: false,
  loading: () => <PreviewAuth title="계정 만들기"><p role="status">가입 화면을 열고 있어요.</p></PreviewAuth>,
});

export default function SignupEntry() {
  return accountConfigured ? <Signup /> : <PreviewAuth title="계정 만들기">
    <Notice title="지금은 가입 화면을 불러올 수 없어요"><a href="/auth/signup">기존 가입 화면 열기</a></Notice>
  </PreviewAuth>;
}
