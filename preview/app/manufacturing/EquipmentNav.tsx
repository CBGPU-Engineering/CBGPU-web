'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Printer, Scissors } from 'lucide-react';
import styles from '../../components/SchoolOps.module.css';

export default function EquipmentNav() {
  const path = usePathname().replace(/^\/new(?=\/)/, '');
  return <nav aria-label="제작 장비" className={styles.inline}>
    <Link className={styles.secondary} href="/manufacturing/print" aria-current={path === '/manufacturing' || path.startsWith('/manufacturing/print') ? 'true' : undefined}><Printer size={17} aria-hidden />3D 프린팅</Link>
    <Link className={styles.secondary} href="/manufacturing/laser" aria-current={path.startsWith('/manufacturing/laser') ? 'true' : undefined}><Scissors size={17} aria-hidden />레이저 커팅</Link>
  </nav>;
}
