import type { Metadata } from 'next';
import WorkspaceEntry from './WorkspaceEntry';

export const metadata: Metadata = { title: '내 계정' };

export default function Page() {
  return <section className="pv-page">
    <header className="pv-page-header"><h1>내 계정</h1></header>
    <WorkspaceEntry />
  </section>;
}
