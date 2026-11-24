'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { SchoolScopeProvider, useSchoolScope } from '@/components/schools/SchoolScope';
import { schoolServiceVisible } from '@/lib/schoolVisibility';
import { Notice } from './DirectoryFeedback';

type SchoolPath = '/meal' | '/timetable';

type SelectedSchool = {
  schoolId: string;
  schoolName?: string;
  studentNumber?: string | null;
  legacy: boolean;
};

type Props = {
  path: SchoolPath;
  label: string;
  children: (school: SelectedSchool) => ReactNode;
};

function WithSchool({ path, label, children }: Props) {
  const { user, profile, isLoading } = useAuth();
  const scope = useSchoolScope();

  if (isLoading) return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if (!user) return <Notice title={path === '/meal' ? '로그인하고 학교 급식을 확인해요' : '로그인하고 학교 시간표를 확인해요'}>
    <Link href={'/auth/login?next=' + encodeURIComponent('/new' + path)}>로그인</Link>
  </Notice>;
  if (scope.status === 'loading' || scope.resource.status === 'loading') {
    return <p role="status">학교 소속을 확인하고 있어요.</p>;
  }
  if (scope.status === 'unavailable') return <Notice title="학교 소속을 확인하지 못했어요">
    <button className="pv-primary" type="button" onClick={() => void scope.refresh()}>다시 확인하기</button>
  </Notice>;
  if (!schoolServiceVisible(scope, path)) return <Notice title={scope.school ? `이 학교의 ${label} 정보가 연결되지 않았어요` : '학교 소속을 확인해 주세요'}>
    <a href="/schools">내 학교 설정 열기</a>
  </Notice>;

  const legacy = scope.status === 'legacy';
  const schoolId = legacy ? 'cbsh' : scope.school?.id;
  if (!schoolId) return <Notice title="학교 소속을 확인해 주세요"><a href="/schools">내 학교 설정 열기</a></Notice>;
  const membership = scope.memberships.find(member => member.school_id === schoolId && member.membership_type === 'STUDENT');

  return <div key={user.id + ':' + schoolId}>
    {children({
      schoolId,
      schoolName: scope.school?.display_name || scope.school?.official_name,
      studentNumber: legacy ? profile?.student_id : membership?.student_number,
      legacy,
    })}
  </div>;
}

export function SchoolWorkspace(props: Props) {
  return <AuthProvider><SchoolScopeProvider><WithSchool {...props} /></SchoolScopeProvider></AuthProvider>;
}
