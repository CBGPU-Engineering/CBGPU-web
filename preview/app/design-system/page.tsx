import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SearchForm } from '../../components/Directory';
import { Notice } from '../../components/DirectoryFeedback';
import { schoolTools } from '../../components/navigation';
import { ToolArt } from '../../components/ToolArt';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (process.env.CBGPU_PREVIEW_SHOWCASE !== '1') notFound();

  return <section className="pv-page pv-showcase">
    <header className="pv-page-header">
      <h1>CBGPU 2.0 디자인 시스템</h1>
      <p>미리보기의 공통 컴포넌트를 확인하는 화면이에요.</p>
    </header>
    <section>
      <h2>탐색과 입력</h2>
      <SearchForm action="/new/services" label="기능 검색" />
      <Link className="pv-primary" href="/services">전체 기능 보기 <ArrowRight size={17} aria-hidden="true" /></Link>
    </section>
    <section>
      <h2>학교생활 아이콘</h2>
      <ul className="pv-shortcuts">
        {schoolTools.map(tool => <li key={tool.href}>
          <div className="pv-shortcut">
            <ToolArt kind={tool.art} />
            <strong>{tool.label}</strong>
          </div>
        </li>)}
      </ul>
    </section>
    <section>
      <h2>목록 상태</h2>
      <Notice title="공개된 항목이 없어요" />
      <Notice title="목록을 불러오지 못했어요"><Link href="/schools">학교 목록 열기</Link></Notice>
    </section>
  </section>;
}
