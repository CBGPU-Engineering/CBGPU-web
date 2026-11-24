'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import SchoolAdministration from '@/components/schools/SchoolAdministration';
import { useSchoolScope } from '@/components/schools/SchoolScope';
import { schoolAdminHref, schoolAdminSections, schoolManagerMemberships } from '@/lib/schoolAdministration';
import { useAuth } from '@/lib/useAuth';
import FeatureProviders from '../../../../components/FeatureProviders';
import { Notice } from '../../../../components/DirectoryFeedback';
import { OptionPicker } from '../../../../components/OptionPicker';
import styles from '../../../../components/SchoolOps.module.css';

function Administration({ id }: { id: string }) {
  const path = '/schools/' + encodeURIComponent(id) + '/admin';
  const { user, isLoading } = useAuth();
  const scope = useSchoolScope();
  const router = useRouter();
  const section = useSearchParams().get('section');
  const member = user && schoolManagerMemberships(scope.memberships, user.id).find(item => item.school_id === id);

  if (isLoading || scope.status === 'loading') return <p role="status">학교 관리 권한을 확인하고 있어요.</p>;
  if (!user) return <Notice title="로그인해서 학교 관리 권한을 확인해요">
    <Link href={'/auth/login?next=' + encodeURIComponent('/new' + path)} className={styles.link}>로그인</Link>
  </Notice>;
  if (!member) return <Notice title={scope.status === 'unavailable' ? '학교 관리 권한을 확인하지 못했어요' : '이 학교의 관리 권한이 없어요'}>
    <Link href="/school-admin" className={styles.link}>관리할 학교 보기</Link>
  </Notice>;

  const schoolAdmin = member.school_roles.some(role => role === 'SCHOOL_OWNER' || role === 'SCHOOL_ADMIN');
  const options = schoolAdmin ? schoolAdminSections : schoolAdminSections.filter(item => item.id === 'gpu' || item.id === 'gpu-reservations');
  const active = options.find(item => item.id === section) || (!section && schoolAdmin ? schoolAdminSections[0] : undefined);
  const name = member.school.display_name || member.school.official_name;

  return <div className={styles.stack}>
    <header className={styles.heading}>
      <Link href="/school-admin" className="pv-back"><ArrowLeft size={17} aria-hidden />관리할 학교 보기</Link>
      <h1>{name} 관리</h1>
    </header>
    <div className={styles.adminGrid}>
      <div className={styles.adminPicker}>
        <OptionPicker label="관리 항목" value={active?.id || ''} options={options.map(item => ({ value: item.id, label: item.label }))}
          onChange={value => router.push(schoolAdminHref(id, value))} />
      </div>
      <nav className={styles.adminNav} aria-label="학교 관리 항목">
        {options.map(item => <Link key={item.id} className={styles.secondary} href={schoolAdminHref(id, item.id)}
          aria-current={item.id === active?.id ? 'true' : undefined}>
          {item.label}<ChevronRight size={15} aria-hidden />
        </Link>)}
      </nav>
      <div className={styles.adminContent}>
        {active ? <div className="cb-school-page"><SchoolAdministration schoolId={id} showSectionNavigation={false} /></div>
          : <Notice title="이 관리 항목에 접근할 수 없어요"><Link className={styles.link} href={schoolAdminHref(id, options[0].id)}>관리할 수 있는 항목 보기</Link></Notice>}
      </div>
    </div>
  </div>;
}

export default function Workspace({ id }: { id: string }) {
  return <FeatureProviders><Administration id={id} /></FeatureProviders>;
}
