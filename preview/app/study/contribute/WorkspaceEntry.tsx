'use client';

import dynamic from 'next/dynamic';
import { Notice } from '../../../components/DirectoryFeedback';
import { accountConfigured } from '../../../components/session';

const Workspace = dynamic(() => import('./Workspace'), {
  ssr: false,
  loading: () => <p role="status">학교 연결 화면을 열고 있어요.</p>,
});

export default function WorkspaceEntry() {
  return accountConfigured
    ? <Workspace />
    : <Notice title="계정 연결을 사용할 수 없어요"><a href="/study/contribute">기존 학교 연결 화면 열기</a></Notice>;
}
