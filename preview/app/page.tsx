import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, GraduationCap } from 'lucide-react';
import { publicList } from '@/lib/publicContentServer';
import { Items, SearchForm, SectionHeading } from '../components/Directory';
import { Notice } from '../components/DirectoryFeedback';
import { previewServicePaths, schoolTools } from '../components/navigation';
import { ToolArt } from '../components/ToolArt';
import { HomeGreeting } from '../components/PreviewIdentity';

const today = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });

export default async function Home() {
  const [contests, projects] = await Promise.all([publicList('contests', 3), publicList('projects', 3)]);
  return (
    <div className="pv-home-layout">
      <header className="pv-masthead">
        <div className="pv-masthead-inner">
          <p className="pv-today"><CalendarDays size={17} aria-hidden="true" /> {today.format(new Date())}</p>
          <HomeGreeting />
          <p>수업부터 프로젝트까지, 필요한 곳으로 바로 가요.</p>
          <SearchForm action="/new/services" label="기능 검색" />
        </div>
      </header>
      <section aria-labelledby="school-tools-title" className="pv-home-shortcuts">
        <div className="pv-section-heading">
          <h2 id="school-tools-title">학교생활 바로가기</h2>
          <Link href="/services">전체 기능 <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <ul className="pv-shortcuts">
          {schoolTools.map(tool => {
            const content = <>
              <span className="pv-tool-tile"><ToolArt kind={tool.art} /></span>
              <strong>{tool.label}</strong>
              <span className="pv-shortcut-description">{tool.description}</span>
              {!previewServicePaths.includes(tool.href) && <ArrowUpRight size={16} className="pv-shortcut-arrow" aria-label="기존 CBGPU" />}
            </>;
            return <li key={tool.href}>{previewServicePaths.includes(tool.href)
              ? <Link href={tool.href} className="pv-shortcut">{content}</Link>
              : <a href={tool.href} className="pv-shortcut">{content}</a>}
            </li>;
          })}
        </ul>
      </section>
      <section aria-labelledby="find-school-title" className="pv-school-feature">
        <div className="pv-school-feature-copy">
          <GraduationCap size={26} aria-hidden="true" />
          <h2 id="find-school-title">우리 학교도 함께해요</h2>
          <p>우리 학교가 CBGPU를 쓰고 있는지 찾아보세요.</p>
          <Link className="pv-primary" href="/schools">우리 학교 찾기 <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        {/* This editorial photo illustrates studying. It does not depict a CBGPU school. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/new/visuals/study-space.webp" alt="" width="1100" height="720" loading="lazy" decoding="async" />
      </section>
      <div className="pv-home-collections">
        <section><SectionHeading title="대회" href="/contests" />
          {contests.ok && contests.data.items.length ? <Items kind="contests" items={contests.data.items} /> : <Notice title={contests.ok ? '공개된 대회가 없어요' : '대회 목록을 불러오지 못했어요'} />}
        </section>
        <section><SectionHeading title="프로젝트" href="/projects" />
          {projects.ok && projects.data.items.length ? <Items kind="projects" items={projects.data.items} /> : <Notice title={projects.ok ? '공개된 프로젝트가 없어요' : '프로젝트를 불러오지 못했어요'} />}
        </section>
      </div>
    </div>
  );
}
