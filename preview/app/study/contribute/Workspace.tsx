'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import StudyContributorPage from '@/app/study/contribute/page';
import { useAuth } from '@/lib/useAuth';
import FeatureProviders from '../../../components/FeatureProviders';
import { Notice } from '../../../components/DirectoryFeedback';
import styles from '../../../components/SchoolOps.module.css';

function Contributor() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if (!user) return <Notice title="로그인한 뒤 학교 연결을 이용할 수 있어요">
    <Link href="/auth/login?next=%2Fnew%2Fstudy%2Fcontribute" className={styles.link}>로그인</Link>
  </Notice>;

  return <>
    <Link href="/study" className="pv-back"><ArrowLeft size={17} aria-hidden />자습 신청</Link>
    <StudyContributorPage key={user.id} />
  </>;
}

export default function Workspace() {
  return <FeatureProviders><Contributor /></FeatureProviders>;
}
