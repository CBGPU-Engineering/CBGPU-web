import { ProjectSelection } from '../../../components/CollaborationFeatures';
import { CollaborationWorkspace } from '../../../components/CollaborationWorkspace';

export const metadata = { title: '내 프로젝트' };

export default function Page() {
  return <CollaborationWorkspace path="/projects/manage" backHref="/projects" backLabel="공개 프로젝트"
    title="내 프로젝트" description="팀을 관리하거나 프로젝트 소개를 게시하려면 로그인해 주세요.">
    <ProjectSelection />
  </CollaborationWorkspace>;
}
