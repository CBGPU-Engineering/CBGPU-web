import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MessageCenter } from '../../../components/CollaborationFeatures';
import { CollaborationWorkspace } from '../../../components/CollaborationWorkspace';

export const metadata = { title: '게시판과 쪽지' };

export default function Page() {
  return <CollaborationWorkspace path="/community/boards" backHref="/community" backLabel="공개 커뮤니티"
    title="게시판과 쪽지" description="글을 쓰거나 학교 게시판과 쪽지를 이용하려면 로그인해 주세요.">
    <Link href="/community" className="pv-back pv-collaboration-community-back"><ArrowLeft size={17} aria-hidden="true" /> 공개 커뮤니티</Link>
    <MessageCenter />
  </CollaborationWorkspace>;
}
