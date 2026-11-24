import type { Metadata } from 'next';
import WorkspaceEntry from './WorkspaceEntry';

export const metadata: Metadata = { title: '학교 관리자' };

export default function Page() {
  return <section className="pv-page">
    <header className="pv-page-header"><h1>학교 관리자</h1><p>관리 권한이 있는 학교를 선택해 주세요.</p></header>
    <WorkspaceEntry />
  </section>;
}
