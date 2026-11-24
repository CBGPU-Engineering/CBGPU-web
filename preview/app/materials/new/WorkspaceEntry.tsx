'use client';

import dynamic from 'next/dynamic';
import { accountConfigured } from '../../../components/session';
import { Notice } from '../../../components/DirectoryFeedback';

const Workspace = dynamic(() => import('./Workspace'), {
  ssr: false,
  loading: () => <p role="status">화면을 열고 있어요.</p>,
});

export default function WorkspaceEntry() {
  return accountConfigured
    ? <Workspace />
    : <Notice title="계정 연결을 사용할 수 없어요"><a href="/materials/new">기존 화면 열기</a></Notice>;
}
