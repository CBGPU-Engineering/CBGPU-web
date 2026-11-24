import { BookOpen, Compass, FolderOpen, GraduationCap, House, MessagesSquare, Trophy } from 'lucide-react';

export const navigation = [
  { href: '/', label: '홈', Icon: House },
  { href: '/schools', label: '학교', Icon: GraduationCap },
  { href: '/projects', label: '프로젝트', Icon: FolderOpen },
  { href: '/contests', label: '대회', Icon: Trophy },
  { href: '/community', label: '커뮤니티', Icon: MessagesSquare },
  { href: '/services', label: '전체 기능', Icon: Compass },
  { href: '/docs', label: '사용 설명서', Icon: BookOpen },
] as const;

export const schoolTools = [
  { href: '/timetable', label: '시간표', description: '오늘 수업과 시간표 확인', art: 'calendar' },
  { href: '/meal', label: '급식', description: '오늘의 메뉴와 알레르기 정보', art: 'meal' },
  { href: '/study', label: '자습 신청', description: '학교에서 제공하는 자습 신청', art: 'study' },
  { href: '/materials', label: '자료 공유', description: '학교 구성원과 자료 나누기', art: 'materials' },
] as const;


export const previewSchoolPaths: readonly string[] = ['/meal', '/timetable'];
