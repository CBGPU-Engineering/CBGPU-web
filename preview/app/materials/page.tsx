import type { Metadata } from 'next';
import WorkspaceEntry from './WorkspaceEntry';

export const metadata: Metadata = { title: '자료 공유' };

export default function Page() {
  return <section className="pv-page">
    <header className="pv-page-header"><h1>자료 공유</h1></header>
    <WorkspaceEntry />
  </section>;
}
