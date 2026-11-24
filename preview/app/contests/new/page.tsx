import { ContestEditor } from '../../../components/CollaborationFeatures';
import { CollaborationWorkspace } from '../../../components/CollaborationWorkspace';

export const metadata = { title: '대회 열기' };

export default function Page() {
  return <CollaborationWorkspace path="/contests/new" backHref="/contests" backLabel="공개 대회"
    title="대회 열기" description="대회 일정과 참가 조건을 정하려면 로그인해 주세요.">
    <ContestEditor />
  </CollaborationWorkspace>;
}
