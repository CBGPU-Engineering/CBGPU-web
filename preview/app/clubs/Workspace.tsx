'use client';

import Link from 'next/link';
import { CalendarDays, School } from 'lucide-react';
import ClubWorkspace from '@/components/clubs/ClubWorkspace';
import { useSchoolScope } from '@/components/schools/SchoolScope';
import { schoolServiceVisible } from '@/lib/schoolVisibility';
import { useAuth } from '@/lib/useAuth';
import FeatureProviders from '../../components/FeatureProviders';
import { Notice } from '../../components/DirectoryFeedback';
import styles from '../../components/SchoolOps.module.css';

function Clubs() {
  const { user, isLoading } = useAuth();
  const scope = useSchoolScope();
  if (isLoading || scope.status === 'loading') return <p role="status">학교 소속을 확인하고 있어요.</p>;
  if (!user) return <Notice title="로그인하면 우리 학교 동아리를 볼 수 있어요">
    <Link href="/auth/login?next=%2Fnew%2Fclubs" className={styles.link}>로그인</Link>
  </Notice>;
  if (!schoolServiceVisible(scope, '/clubs')) return <Notice title={scope.school ? '이 학교의 동아리 모집을 이용할 수 없어요' : '학교 소속을 확인해 주세요'}>
    <Link href="/schools" className={styles.link}>내 학교 확인하기</Link>
  </Notice>;
  return <div className={styles.stack}>
    <div className={styles.inline}><School size={18} aria-hidden />{scope.school?.display_name || scope.school?.official_name}</div>
    <aside className={styles.panel} aria-label="동아리 모집 안내">
      <div className={styles.inline}><CalendarDays size={19} aria-hidden /><h2>학교의 모집 일정에 맞춰 지원해요</h2></div>
      <p className={styles.muted}>모집 회차마다 홍보 등록, 공개, 지원 기간이 달라요. 회차를 골라 날짜를 확인해 주세요.</p>
    </aside>
    <div className={styles.clubContent}><ClubWorkspace /></div>
  </div>;
}

export default function Workspace() {
  return <FeatureProviders><Clubs /></FeatureProviders>;
}
