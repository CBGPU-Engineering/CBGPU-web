'use client';

import dynamic from 'next/dynamic';
import { accountConfigured } from '../../components/session';
import { Notice } from '../../components/DirectoryFeedback';

const MealWorkspace = dynamic(() => import('./MealWorkspace'), {
  ssr: false,
  loading: () => <p role="status">급식 화면을 열고 있어요.</p>,
});

export default function MealEntry() {
  return accountConfigured
    ? <MealWorkspace />
    : <Notice title="학교 연결을 사용할 수 없어요"><a href="/meal">기존 급식 화면 열기</a></Notice>;
}
