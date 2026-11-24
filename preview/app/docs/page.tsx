import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { docCategories, guides } from '@/components/publications/docs';
import { matchesService } from '@/lib/serviceDiscovery';
import { SearchForm, type DirectoryParams } from '../../components/Directory';
import { Notice } from '../../components/DirectoryFeedback';

export const metadata = { title: '사용 설명서' };

export default async function Page({ searchParams }: {
  searchParams: DirectoryParams & Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.query === 'string' ? params.query.trim().slice(0, 65) : '';
  const current = docCategories.find(category => category.id === params.category)?.id;
  const results = guides.filter(guide => (!current || guide.category === current) && matchesService(query, [
    guide.title, guide.description, ...(guide.keywords ?? []), ...guide.features,
    ...guide.sections.flatMap(section => [section.title, section.body, ...(section.steps ?? [])]),
  ].join(' ')));
  const categories = [{ id: '', title: '전체' }, ...docCategories];

  function categoryHref(category: string) {
    const search = new URLSearchParams();
    if (query) search.set('query', query);
    if (category) search.set('category', category);
    return '/docs' + (search.size ? '?' + search : '');
  }

  return <section className="pv-page pv-docs">
    <header className="pv-page-header">
      <h1>CBGPU 사용 설명서</h1>
      <p>계정, 학교생활, 대회와 연구·개발 기능의 사용법을 찾아보세요.</p>
      <SearchForm action="/new/docs" label="문서 검색" value={query} hidden={current ? { category: current } : undefined} />
    </header>
    <nav className="pv-doc-categories" aria-label="문서 분류">
      {categories.map(category => <Link key={category.id} href={categoryHref(category.id)} aria-current={(current || '') === category.id ? 'page' : undefined}>{category.title}</Link>)}
    </nav>
    <p className="pv-result-count">문서 {results.length}개</p>
    {results.length ? <ul className="pv-list">{results.map(guide => <li key={guide.slug}>
      <Link className="pv-item" href={'/docs/' + guide.slug}>
        <span className="pv-row-icon"><BookOpen size={21} aria-hidden="true" /></span>
        <span className="pv-item-body"><strong>{guide.title}</strong><span>{guide.description}</span></span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </li>)}</ul> : <Notice title="검색 결과가 없어요"><Link href="/docs">전체 문서 보기</Link></Notice>}
  </section>;
}
