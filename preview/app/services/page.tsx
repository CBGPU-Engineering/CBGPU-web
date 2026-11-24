import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, FolderOpen, GraduationCap, MessagesSquare, Trophy } from 'lucide-react';
import { serviceGroups, type Service } from '@/lib/serviceNavigation';
import { SearchForm, type DirectoryParams } from '../../components/Directory';
import { Notice } from '../../components/DirectoryFeedback';
import { previewServicePaths, schoolTools } from '../../components/navigation';
import { ToolArt } from '../../components/ToolArt';

const discovery = [
  { href: '/schools', label: '학교', description: '도입된 학교와 공개 소개', icon: GraduationCap },
  { href: '/projects', label: '공개 프로젝트', description: '학생들이 공개한 작업', icon: FolderOpen },
  { href: '/contests', label: '공개 대회', description: '공개 대회와 참가 일정', icon: Trophy },
  { href: '/community', label: '공개 커뮤니티', description: '공개 게시글 둘러보기', icon: MessagesSquare },
  { href: '/docs', label: '사용 설명서', description: '기능별 사용법과 문제 해결', icon: BookOpen },
];

const groups: { id: string; title: string; services: Service[] }[] = [
  ...serviceGroups.map(group => group.id === 'school'
    ? { ...group, services: [...group.services, { href: '/feed', label: '학사 일정', description: '학교 소식에서 행사와 학사 날짜 확인', icon: CalendarDays }] }
    : group),
  { id: 'discover', title: '공개 콘텐츠', services: discovery },
];

export const metadata = { title: '전체 기능' };

export default async function Page({ searchParams }: { searchParams: DirectoryParams }) {
  const { query: input } = await searchParams;
  const query = typeof input === 'string' ? input.slice(0, 65).trim() : '';
  const normalized = query.toLocaleLowerCase().replace(/\s+/g, '');
  const visible = groups.map(group => ({
    ...group,
    entries: group.services.filter(entry => (entry.label + entry.description + group.title + (entry.keywords ?? '')).toLocaleLowerCase().replace(/\s+/g, '').includes(normalized)),
  })).filter(group => group.entries.length);

  return <section className="pv-page">
    <header className="pv-page-header">
      <h1>전체 기능</h1>
      <SearchForm action="/new/services" label="기능 검색" value={query} />
    </header>
    {visible.length ? visible.map(group => <section key={group.title} className="pv-service-group">
      <h2>{group.title}</h2>
      <ul className="pv-list">
        {group.entries.map(entry => {
          const art = schoolTools.find(tool => tool.href === entry.href)?.art;
          const preview = group.id === 'discover' || previewServicePaths.includes(entry.href);
          const content = <>
            <span className="pv-row-icon">{art ? <ToolArt kind={art} /> : <entry.icon size={23} aria-hidden="true" />}</span>
            <span className="pv-item-body"><strong>{entry.label}</strong><span>{entry.description}</span></span>
            {preview ? <ArrowRight size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-label="기존 CBGPU" />}
          </>;
          return <li key={entry.href}>{preview
            ? <Link className="pv-item" href={entry.href}>{content}</Link>
            : <a className="pv-item" href={entry.href}>{content}</a>}
          </li>;
        })}
      </ul>
    </section>) : <Notice title="검색 결과가 없어요"><Link href="/services">전체 기능 보기</Link></Notice>}
  </section>;
}
