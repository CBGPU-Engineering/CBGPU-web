'use client';

import Link from 'next/link';
import { ArrowRight, Code2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deploymentApi, serverProjectRequest } from '@/lib/deploymentApi';
import { publicPath } from '@/lib/publicContentModel';
import { CollaborationAction } from './CollaborationWorkspace';
import { Notice } from './DirectoryFeedback';

const groups = [
  { id: 'frontend', title: '프론트엔드 프로젝트', icon: Code2, path: '/deploy' },
  { id: 'server', title: '서버 프로젝트', icon: Server, path: '/server' },
] as const;
type Kind = typeof groups[number]['id'];
type Project = { id: string; name: string; role: 'owner' | 'editor' | 'viewer' };
type ProjectGroup = { projects: Project[]; unavailable: boolean };
const roles = { owner: '소유자', editor: '편집자', viewer: '보기 전용' };

function summarizeProjects(value: unknown, kind: Kind): ProjectGroup {
  if (!Array.isArray(value)) return { projects: [], unavailable: true };
  return { projects: value.flatMap(project => {
    const name = project?.[kind === 'frontend' ? 'slug' : 'name'];
    const role = project?.collaboration_role;
    return typeof project?.id === 'string' && publicPath(['projects', project.id]) && typeof name === 'string' &&
      (role === 'owner' || role === 'editor' || role === 'viewer')
      ? [{ id: project.id, name, role }] : [];
  }), unavailable: false };
}

export default function CollaborationProjectList() {
  const [result, setResult] = useState<Record<Kind, ProjectGroup> | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    void Promise.allSettled([deploymentApi('projects'), serverProjectRequest()]).then(([frontend, server]) => {
      if (!current) return;
      setResult({
        frontend: summarizeProjects(frontend.status === 'fulfilled' ? frontend.value.projects : null, 'frontend'),
        server: summarizeProjects(server.status === 'fulfilled' && !server.value.error ? server.value.data : null, 'server'),
      });
    });
    return () => { current = false; };
  }, [revision]);

  return <>
    <header className="pv-collaboration-heading">
      <div><Link href="/projects" className="pv-back">공개 프로젝트 둘러보기</Link><h1>내 프로젝트</h1>
        <p>내가 만든 프로젝트와 함께 작업하는 프로젝트의 구성원을 관리해요.</p></div>
      <CollaborationAction href="/projects/manage/publication">프로젝트 소개 편집</CollaborationAction>
    </header>
    {!result ? <p role="status">내 프로젝트를 불러오고 있어요.</p> : groups.map(({ id, title, icon: Icon, path }) => <section className="pv-collaboration-section" key={id}>
      <header className="pv-collaboration-group-heading"><h2>{title}</h2><Link href={path + '/new'}>프로젝트 만들기 <ArrowRight size={16} aria-hidden="true" /></Link></header>
      {result[id].unavailable ? <Notice title="프로젝트를 불러오지 못했어요">
        <button className="pv-primary" type="button" onClick={() => { setResult(null); setRevision(value => value + 1); }}>다시 불러오기</button>
      </Notice> : result[id].projects.length ? <ul className="pv-collaboration-list">
        {result[id].projects.map(project => <li key={project.id}>
          <span className="pv-row-icon"><Icon size={21} aria-hidden="true" /></span>
          <div><h3><Link href={path + '/' + project.id}>{project.name}</Link></h3><p className="pv-meta">{roles[project.role]}</p></div>
          <div className="pv-collaboration-row-actions">
            <Link href={`/projects/manage/${id}/${project.id}`} prefetch={false} aria-label={project.name + ' 공동작업자 확인'}>공동작업자 <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </li>)}
      </ul> : <Notice title="함께 작업하는 프로젝트가 아직 없어요" />}
    </section>)}
  </>;
}
