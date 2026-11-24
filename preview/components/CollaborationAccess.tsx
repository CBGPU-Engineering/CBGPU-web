'use client';

import { useAuth } from '@/lib/useAuth';
import FeatureProviders from './FeatureProviders';
import { SignInNotice, type WorkspaceProps } from './CollaborationWorkspace';

function WorkspaceAccess({ children, ...props }: WorkspaceProps) {
  const { isLoading, user } = useAuth();
  if (isLoading) return <p className="pv-page" role="status">로그인 상태를 확인하고 있어요.</p>;
  if (!user) return <SignInNotice {...props} />;
  return <div className="pv-page pv-collaboration-workspace" key={user.id}>{children}</div>;
}

export default function CollaborationAccess(props: WorkspaceProps) {
  return <FeatureProviders><WorkspaceAccess {...props} /></FeatureProviders>;
}
