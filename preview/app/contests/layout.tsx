import type { ReactNode } from 'react';
import { ContestCoverTransition } from '../../components/CollaborationContestTransition';
import '@/app/contests/contests.css';

export default function ContestLayout({ children }: { children: ReactNode }) {
  return <ContestCoverTransition>{children}</ContestCoverTransition>;
}
