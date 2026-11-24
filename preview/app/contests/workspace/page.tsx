import { ContestWorkspaceList } from '../../../components/CollaborationFeatures';
import { CollaborationWorkspace } from '../../../components/CollaborationWorkspace';

export const metadata = { title: '참가·운영 대회' };

export default function Page() {
  return <CollaborationWorkspace path="/contests/workspace" backHref="/contests" backLabel="공개 대회"
    title="참가·운영 대회" description="참가할 수 있는 대회와 내가 운영하는 대회를 확인하려면 로그인해 주세요.">
    <ContestWorkspaceList />
  </CollaborationWorkspace>;
}
