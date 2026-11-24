import type { Metadata } from 'next';
import WorkspaceEntry from './WorkspaceEntry';

export const metadata: Metadata = { title: '기상송' };

export default function Page() {
  return <section className="pv-page">
    <header className="pv-page-header"><h1>기상송</h1></header>
    <WorkspaceEntry />
  </section>;
}
