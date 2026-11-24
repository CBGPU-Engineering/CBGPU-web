import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import EquipmentNav from './EquipmentNav';

export const metadata: Metadata = { title: '학교 제작 장비' };

export default function Layout({ children }: { children: ReactNode }) {
  return <section className="pv-page">
    <header className="pv-page-header"><h1>학교 제작 장비</h1></header>
    <EquipmentNav />
    {children}
  </section>;
}
