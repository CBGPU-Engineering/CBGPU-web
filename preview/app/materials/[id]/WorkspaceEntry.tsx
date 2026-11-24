'use client';

import dynamic from 'next/dynamic';
import { Notice } from '../../../components/DirectoryFeedback';
import { accountConfigured } from '../../../components/session';

const Material = dynamic(() => import('./Workspace'), { ssr: false, loading: () => <p role="status">자료 화면을 열고 있어요.</p> });

export default function WorkspaceEntry({ id }: { id: string }) {
  return accountConfigured
    ? <Material id={id} />
    : <Notice title="계정 연결을 사용할 수 없어요"><a href={'/materials/' + encodeURIComponent(id)}>기존 자료 화면 열기</a></Notice>;
}
