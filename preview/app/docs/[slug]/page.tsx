import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { guides, type GuideSection } from '@/components/publications/docs';
import { schoolApplicationHref, schoolIntegrationId } from '@/lib/schoolIntegrationLink';
import { previewSchoolPaths } from '../../../components/navigation';

type GuideLink = NonNullable<GuideSection['links']>[number];

function DocumentLink({ link }: { link: GuideLink }) {
  const url = new URL(link.href, 'https://cbgpu.com');
  if (url.protocol !== 'https:' || url.username || url.password) return <span>{link.label}</span>;
  const slug = url.pathname.startsWith('/docs/') ? url.pathname.slice(6) : url.pathname.slice(1);
  if ((url.hostname === 'docs.cbgpu.com' || url.hostname === 'cbgpu.com' && url.pathname.startsWith('/docs/')) && guides.some(guide => guide.slug === slug)) {
    return <Link href={'/docs/' + slug + url.search + url.hash}>{link.label}</Link>;
  }
  const local = url.hostname === 'cbgpu.com';
  const href = url.pathname + url.search + url.hash;
  if (local && (previewSchoolPaths.includes(url.pathname) || ['/services', '/schools', '/projects', '/docs'].includes(url.pathname))) {
    return <Link href={href}>{link.label}</Link>;
  }
  return <a href={local ? href : url.href} target={link.newTab ? '_blank' : undefined} rel={link.newTab ? 'noopener noreferrer' : undefined}>
    {link.label} <ArrowUpRight size={15} aria-label={link.newTab ? '새 탭' : '기존 CBGPU 또는 외부 사이트'} />
  </a>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides.find(item => item.slug === slug);
  return { title: guide?.title ?? '문서', description: guide?.description };
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ catalog_school_id?: string | string[] }>;
}) {
  const { slug } = await params;
  const index = guides.findIndex(guide => guide.slug === slug);
  if (index === -1) notFound();
  const guide = guides[index];
  const [previous, next] = [guides[index - 1], guides[index + 1]];
  const school = schoolIntegrationId((await searchParams).catalog_school_id);
  const related = guide.related.flatMap(id => guides.filter(item => item.slug === id));

  return <section className="pv-page pv-docs">
    <Link className="pv-back" href="/docs"><ArrowLeft size={17} aria-hidden="true" /> 전체 문서</Link>
    <header className="pv-page-header">
      <h1>{guide.title}</h1>
      <p>{guide.description}</p>
      {guide.updatedAt && <p className="pv-meta">확인 날짜 · <time dateTime={guide.updatedAt}>{guide.updatedAt}</time></p>}
    </header>
    {slug === 'school-integration' && <div className="pv-doc-start">
      <h2>먼저 우리 학교를 찾아보세요</h2>
      <p>이미 CBGPU를 쓰거나 도입을 신청한 학교라면 교내 담당자와 함께 진행해 주세요.</p>
      <Link href="/schools">학교 찾기 <ArrowRight size={16} aria-hidden="true" /></Link>
      {school && <a href={schoolApplicationHref(school)}>선택한 학교로 도입 신청 이어가기 <ArrowUpRight size={16} aria-hidden="true" /></a>}
    </div>}
    <div className="pv-doc-layout">
      <nav className="pv-doc-toc" aria-label="문서 목차">
        <strong>이 문서에서</strong>
        {guide.sections.map((section, i) => <a key={i} href={'#section-' + (i + 1)}>{section.title}</a>)}
      </nav>
      <details className="pv-doc-mobile-toc">
        <summary>문서 목차</summary>
        <nav aria-label="모바일 문서 목차">
          {guide.sections.map((section, i) => <a key={i} href={'#section-' + (i + 1)}>{section.title}</a>)}
        </nav>
      </details>
      <article className="pv-doc-article">
        {guide.sections.map((section, i) => <section id={'section-' + (i + 1)} key={i}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
          {section.steps?.length && <ol>{section.steps.map((step, number) => <li key={number}>{step}</li>)}</ol>}
          {section.code && <pre tabIndex={0} aria-label={section.title + ' 명령어'}><code>{section.code}</code></pre>}
          {section.links?.length && <div className="pv-doc-links">{section.links.map((link, number) => <DocumentLink link={link} key={number} />)}</div>}
        </section>)}
        {related.length > 0 && <section className="pv-doc-links">
          <h2>이어서 읽기</h2>
          {related.map(item => <Link key={item.slug} href={'/docs/' + item.slug}>{item.title}</Link>)}
        </section>}
        <nav className="pv-doc-pager" aria-label="이전 다음 문서">
          {previous && <Link href={'/docs/' + previous.slug}><ArrowLeft size={17} aria-hidden="true" /> {previous.title}</Link>}
          {next && <Link href={'/docs/' + next.slug}>{next.title} <ArrowRight size={17} aria-hidden="true" /></Link>}
        </nav>
      </article>
    </div>
  </section>;
}
