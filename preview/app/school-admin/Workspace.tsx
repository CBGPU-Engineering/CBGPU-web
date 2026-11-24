'use client';

import Link from 'next/link';
import { ArrowUpRight, School } from 'lucide-react';
import { useSchoolScope } from '@/components/schools/SchoolScope';
import { schoolManagerHome, schoolManagerMemberships } from '@/lib/schoolAdministration';
import { useAuth } from '@/lib/useAuth';
import SchoolOpsAccount from '../../components/SchoolOpsAccount';
import { Notice } from '../../components/DirectoryFeedback';
import styles from '../../components/SchoolOps.module.css';

function Schools() {
  const { user } = useAuth();
  const scope = useSchoolScope();
  const memberships = user ? schoolManagerMemberships(scope.memberships, user.id) : [];

  if (scope.status === 'loading') return <p role="status">학교 관리 권한을 확인하고 있어요.</p>;
  if (scope.status === 'unavailable') return <Notice title="관리할 학교를 불러오지 못했어요">
    <button type="button" className={styles.secondary} onClick={() => void scope.refresh()}>다시 불러오기</button>
  </Notice>;
  if (!memberships.length) return <Notice title="학교 관리 권한이 없어요"><Link className={styles.link} href="/schools">학교 목록 보기</Link></Notice>;

  return <ul className="pv-list">{memberships.map(member => <li key={member.id}>
    <Link className={styles.roomLink} href={schoolManagerHome(member)}>
      <span className={styles.fileMark}><School size={20} aria-hidden /></span>
      <strong>{member.school.display_name || member.school.official_name}</strong><ArrowUpRight size={16} aria-hidden />
    </Link>
  </li>)}</ul>;
}

export default function Workspace() {
  return <SchoolOpsAccount path="/school-admin"><Schools /></SchoolOpsAccount>;
}
