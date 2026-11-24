import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, FolderOpen, GraduationCap, MessagesSquare, Search, Trophy } from 'lucide-react';
import { publicExcerpt, publicLabel, publicPath, publicTitles, type PublicItem, type PublicKind } from '@/lib/publicContentModel';
import { fetchPublicContent, publicDetail } from '@/lib/publicContentServer';
import PublicMarkdown from '@/components/public-browsing/PublicMarkdown';
import { notFound } from 'next/navigation';
import { ContestCover, ContestCoverLink } from './CollaborationContestTransition';
import { Notice } from './DirectoryFeedback';

const symbols = { schools: GraduationCap, projects: FolderOpen, contests: Trophy, community: MessagesSquare };
const descriptions = {
  schools: '학교를 찾아 CBGPU 도입 여부와 학교 소개를 확인해요.',
  projects: '다른 학생들이 만들고 공개한 작업을 둘러보세요.',
  contests: '공개 대회의 일정과 참가 조건을 확인해요.',
  community: '누구나 볼 수 있도록 공개된 글이에요.',
};

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Seoul',
});

function date(value: PublicItem[string] | undefined) {
  if (typeof value !== 'string') return '';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateFormat.format(parsed) : '';
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function SearchForm({ action, label, value = '', hidden }: { action: string; label: string; value?: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} method="get" className="pv-search" role="search" aria-label={label}>
      {hidden && Object.entries(hidden).map(([name, field]) => <input type="hidden" name={name} value={field} key={name} />)}
      <Search size={20} aria-hidden="true" />
      <input name="query" type="search" aria-label={label} placeholder={label} defaultValue={value} maxLength={65} />
      <button type="submit">검색</button>
    </form>
  );
}

export function SectionHeading({ title, href }: { title: string; href?: string }) {
  return <div className="pv-section-heading">
    <h2>{title}</h2>
    {href && <Link href={href}>모두 보기 <ArrowRight size={16} aria-hidden="true" /></Link>}
  </div>;
}

function ItemBody({ kind, item }: { kind: PublicKind; item: PublicItem }) {
  const Icon = symbols[kind];
  const meta = kind === 'contests'
    ? text(item.organizer_school_names || item.organizer || item.school_name)
    : kind === 'schools' ? text(item.region) : text(item.board_name || item.school_name);
  const when = kind === 'contests' ? date(item.registration_closes_at || item.event_start_at) : date(item.created_at);
  const description = publicExcerpt(item.summary || item.description || item.body || item.public_description, kind === 'community' ? 500 : 160);
  return <>
    {kind === 'contests' ? <ContestCover id={item.id} banner={text(item.banner_url) || undefined} /> : <span className="pv-row-icon"><Icon size={23} aria-hidden="true" /></span>}
    <div className="pv-item-body">
      {meta && <p className="pv-meta">{meta}</p>}
      <h3>{publicLabel(item)}</h3>
      {description && <p>{description}</p>}
      {kind === 'schools' && <span className={item.status === 'APPROVED' ? 'pv-school-active' : 'pv-meta'}>
        {item.status === 'APPROVED' ? '이미 도입됐어요' : '아직 도입되지 않은 학교예요'}
      </span>}
      {when && <p className="pv-date"><CalendarDays size={15} aria-hidden="true" /> {kind === 'contests' && item.registration_closes_at ? '신청 마감 · ' : ''}{when}</p>}
    </div>
    {kind !== 'community' && <ArrowRight className="pv-row-arrow" size={18} aria-hidden="true" />}
  </>;
}

export function Items({ kind, items }: { kind: PublicKind; items: PublicItem[] }) {
  return <ul className={'pv-list pv-list-' + kind}>{items.map(item => {
    const detail = kind !== 'community' && publicPath([kind, item.id]);
    if (kind === 'contests' && detail) return <li key={item.id}><ContestCoverLink id={item.id} banner={text(item.banner_url) || undefined}><ItemBody kind={kind} item={item} /></ContestCoverLink></li>;
    return <li key={item.id}>
      {detail
        ? <Link className="pv-item" href={`/${kind}/${encodeURIComponent(item.id)}`}><ItemBody kind={kind} item={item} /></Link>
        : <article className="pv-item"><ItemBody kind={kind} item={item} /></article>}
    </li>;
  })}</ul>;
}

function collectionHref(kind: PublicKind, query: string, offset: number) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (offset) params.set('offset', String(offset));
  return '/' + kind + (params.size ? '?' + params : '');
}

export type DirectoryParams = Promise<{ query?: string | string[]; offset?: string | string[] }>;
const pageSize = 18;

function cleanQuery(query: unknown) {
  return typeof query === 'string' ? Array.from(query.trim().replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, 50).join('') : '';
}

export async function Directory({ kind, searchParams, toolbar }: { kind: PublicKind; searchParams: DirectoryParams; toolbar?: ReactNode }) {
  const params = await searchParams;
  const query = cleanQuery(params.query);
  const offset = typeof params.offset === 'string' && /^\d{1,5}$/.test(params.offset) ? Math.min(Number(params.offset), 10_000) : 0;
  const result = await fetchPublicContent([kind], new URLSearchParams({ query, limit: String(pageSize), offset: String(offset) }));
  const data = result.ok && 'items' in result.data ? result.data : null;

  return <section className="pv-page">
    <header className="pv-page-header">
      <h1>{publicTitles[kind]}</h1>
      <p>{descriptions[kind]}</p>
      <SearchForm action={'/new/' + kind} label={publicTitles[kind] + ' 검색'} value={query} />
      {toolbar}
    </header>
    <h2 className="pv-visually-hidden">검색 결과</h2>
    {!data ? <Notice title="목록을 불러오지 못했어요">
      <p>잠시 뒤 다시 시도해 주세요.</p>
      <a href={'/new' + collectionHref(kind, query, offset)}>다시 불러오기</a>
    </Notice> : <>
      <p className="pv-result-count">총 {data.total.toLocaleString('ko-KR')}개</p>
      {data.items.length ? <Items kind={kind} items={data.items} /> : <Notice title={query ? '검색 결과가 없어요' : '공개된 항목이 없어요'}>
        {offset > 0 && <Link href={collectionHref(kind, query, 0)}>첫 페이지로</Link>}
        {query && <Link href={'/' + kind}>전체 목록 보기</Link>}
      </Notice>}
      {(offset > 0 || offset + pageSize < data.total) && <nav className="pv-pagination" aria-label="결과 페이지">
        {offset > 0 && <Link href={collectionHref(kind, query, Math.max(0, offset - pageSize))}><ChevronLeft size={16} aria-hidden="true" /> 이전</Link>}
        {offset + pageSize < data.total && offset + pageSize <= 10_000 && <Link href={collectionHref(kind, query, offset + pageSize)}>다음 <ChevronRight size={16} aria-hidden="true" /></Link>}
      </nav>}
    </>}
  </section>;
}

export async function Detail({ kind, id, actions }: { kind: Exclude<PublicKind, 'community'>; id: string; actions?: ReactNode }) {
  if (!publicPath([kind, id])) notFound();
  const result = await publicDetail(kind, id);
  if ((!result.ok && result.status === 404) || (result.ok && !result.data.item)) notFound();
  const back = <Link className="pv-back" href={'/' + kind}><ArrowLeft size={17} aria-hidden="true" /> {publicTitles[kind]}</Link>;
  if (!result.ok) return <section className="pv-page">{back}<Notice title="내용을 불러오지 못했어요"><a href={`/new/${kind}/${encodeURIComponent(id)}`}>다시 불러오기</a></Notice></section>;
  const item = result.data.item!;
  const facts = kind === 'contests' ? [
    ['주최', text(item.organizer_school_names || item.organizer || item.school_name)],
    ['일정', [date(item.event_start_at), date(item.event_end_at)].filter(Boolean).join(' ~ ')],
    ['신청 기간', [date(item.registration_opens_at), date(item.registration_closes_at)].filter(Boolean).join(' ~ ')],
    ['장소', text(item.location_name)],
    ['참가 방식', item.participation_mode === 'team' ? '팀 참가' : item.participation_mode === 'individual' ? '개인 참가' : ''],
    ['참가 대상', text(item.eligibility)],
  ] : kind === 'schools' ? [
    ['지역', text(item.region)],
    ['도입 상태', item.status === 'APPROVED' ? '이미 도입됐어요' : '아직 도입되지 않은 학교예요'],
  ] : [['소속 학교', text(item.school_name)]];
  const action = kind === 'contests'
    ? { href: '/contests/' + encodeURIComponent(id) + '#participation', label: '참가 조건 확인하기' }
    : kind === 'schools'
      ? item.status === 'APPROVED' ? { href: '/schools', label: '학교 소속 요청하기' } : { href: '/schools/new', label: '우리 학교에 도입하기' }
      : { href: '/publications', label: '내 프로젝트 소개하기' };

  return <article className="pv-page pv-detail">
    {back}
    <h1>{publicLabel(item)}</h1>
    {item.summary && <p className="pv-detail-summary">{text(item.summary)}</p>}
    {kind === 'contests' && <ContestCover id={item.id} banner={text(item.banner_url) || undefined} destination />}
    {facts.some(([, value]) => value) && <dl className="pv-facts">
      {facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
    <PublicMarkdown>{text(item.body_markdown || item.description || item.public_description) || '추가 공개 설명이 없어요.'}</PublicMarkdown>
    <div className="pv-actions">
      {actions ?? <>
      <a className="pv-primary" href={action.href}>{action.label} <ArrowRight size={16} aria-hidden="true" /></a>
      <p>기존 CBGPU에서 이어서 진행해요.</p>
      </>}
    </div>
  </article>;
}
