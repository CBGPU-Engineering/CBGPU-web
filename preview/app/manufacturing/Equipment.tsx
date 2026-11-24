'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/useAuth';
import FeatureProviders from '../../components/FeatureProviders';
import { Notice } from '../../components/DirectoryFeedback';
import styles from '../../components/SchoolOps.module.css';

const Requests = dynamic(() => import('@/components/manufacturing/ManufacturingPage'), { ssr: false });
const NewPrint = dynamic(() => import('@/app/manufacturing/print/new/page'), { ssr: false });
const NewLaser = dynamic(() => import('@/app/manufacturing/laser/new/page'), { ssr: false });
const PrintDetails = dynamic(() => import('@/app/manufacturing/print/[id]/page'), { ssr: false });
const LaserDetails = dynamic(() => import('@/app/manufacturing/laser/[id]/page'), { ssr: false });

export type Props = { kind: 'print' | 'laser'; stage: 'requests' | 'new' | 'details'; id?: string };

function Requester({ kind, stage, id }: Props) {
  const { user, isLoading } = useAuth();
  const path = '/manufacturing/' + kind + (stage === 'new' ? '/new' : id ? '/' + encodeURIComponent(id) : '');
  if (isLoading) return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if (!user) return <Notice title="로그인하면 내 제작 신청을 확인할 수 있어요">
    <Link className={styles.link} href={'/auth/login?next=' + encodeURIComponent('/new' + path)}>로그인</Link>
  </Notice>;
  if (stage === 'requests') return <Requests key={user.id + ':' + kind} view={kind} />;
  if (stage === 'new') return kind === 'print' ? <NewPrint key={user.id} /> : <NewLaser key={user.id} />;
  return kind === 'print' ? <PrintDetails key={user.id + ':' + id} /> : <LaserDetails key={user.id + ':' + id} />;
}

export default function Equipment(props: Props) {
  return <FeatureProviders><Requester {...props} /></FeatureProviders>;
}
