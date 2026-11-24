'use client';

import Link from 'next/link';
import { Notice } from '../../../components/DirectoryFeedback';
import { PreviewAuth, previewAuthHref, usePreviewReturn } from '../PreviewAuth';

export default function ResetEntry() {
  const next = usePreviewReturn();
  return <PreviewAuth title="비밀번호 재설정"
    description="받은 메일에서 재설정 링크를 열면 새 비밀번호를 정할 수 있어요."
    footer={<Link href={previewAuthHref('/auth/login', next)}>로그인으로 돌아가기</Link>}>
    <Notice title="재설정 링크가 필요해요">
      <Link className="pv-primary" href={previewAuthHref('/auth/forgot-password', next)}>재설정 링크 받기</Link>
    </Notice>
  </PreviewAuth>;
}
