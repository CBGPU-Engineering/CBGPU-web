'use client';

import dynamic from 'next/dynamic';
import { Notice } from '../../components/DirectoryFeedback';
import { accountConfigured } from '../../components/session';
import type { Props } from './Equipment';

const Equipment = dynamic(() => import('./Equipment'), {
  ssr: false,
  loading: () => <p role="status">제작 신청 화면을 열고 있어요.</p>,
});

export default function EquipmentEntry(props: Props) {
  return accountConfigured
    ? <Equipment {...props} />
    : <Notice title="계정 연결을 사용할 수 없어요"><a href={'/manufacturing/' + props.kind}>기존 제작 신청 화면 열기</a></Notice>;
}
