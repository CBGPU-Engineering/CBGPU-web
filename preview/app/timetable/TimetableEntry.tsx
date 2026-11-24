'use client';

import dynamic from 'next/dynamic';
import { accountConfigured } from '../../components/session';
import { Notice } from '../../components/DirectoryFeedback';

const Workspace = dynamic(() => import('./TimetableWorkspace'), {
  ssr: false,
  loading: () => <p role="status">시간표 화면을 열고 있어요.</p>,
});

export default function TimetableEntry() {
  return accountConfigured
    ? <Workspace />
    : <Notice title="학교 연결을 사용할 수 없어요"><a href="/timetable">기존 시간표 화면 열기</a></Notice>;
}
