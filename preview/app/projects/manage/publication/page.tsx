import { ProjectPublications } from '../../../../components/CollaborationFeatures';
import { CollaborationWorkspace } from '../../../../components/CollaborationWorkspace';

export const metadata = { title: '프로젝트 소개 편집' };

export default function Page() {
  return <CollaborationWorkspace path="/projects/manage/publication" backHref="/projects/manage" backLabel="내 프로젝트"
    title="프로젝트 소개 편집" description="공개 소개를 작성하거나 수정하려면 로그인해 주세요.">
    <ProjectPublications />
  </CollaborationWorkspace>;
}
