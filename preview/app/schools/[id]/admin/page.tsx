import type { Metadata } from 'next';
import WorkspaceEntry from './WorkspaceEntry';

export const metadata: Metadata = { title: '학교 관리' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <section className="pv-page"><WorkspaceEntry id={id} /></section>;
}
