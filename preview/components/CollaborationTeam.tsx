'use client';

import ProjectTeam from '@/components/deploy/ProjectTeam';
import { useAlert } from '@/lib/alert';

export default function CollaborationTeam({ id, kind }: { id: string; kind: 'frontend' | 'server' }) {
  const { confirm } = useAlert();
  return <ProjectTeam id={id} kind={kind} confirmRemoval={(name, self) => confirm(self ? {
    title: '프로젝트에서 나갈까요?',
    message: '나가면 이 프로젝트의 설정과 기록에 접근할 수 없어요. 다시 함께하려면 소유자가 추가해야 해요.',
    confirmLabel: '프로젝트 나가기',
    cancelLabel: '계속 함께하기',
  } : {
    title: name + ' 님을 공동작업에서 제외할까요?',
    message: '제외하면 이 프로젝트에 대한 접근 권한이 사라져요.',
    confirmLabel: '공동작업자 제외',
    cancelLabel: '취소',
  })} />;
}
