import type { Metadata } from 'next';
import WorkspaceEntry from './WorkspaceEntry';

export const metadata: Metadata = { title: '학교 연결 기여' };

export default function Page() {
  return <section className="pv-page"><WorkspaceEntry /></section>;
}
