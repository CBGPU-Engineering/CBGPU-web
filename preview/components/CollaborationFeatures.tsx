'use client';

import dynamic from 'next/dynamic';

export const ContestEditor = dynamic(() => import('@/app/contests/new/page'), { ssr: false });
export const ContestDetailPage = dynamic(() => import('@/app/contests/[id]/page'), { ssr: false });
export const MessageCenter = dynamic(() => import('@/components/schools/MessageCenter'), { ssr: false });
export const ProjectTeam = dynamic(() => import('./CollaborationTeam'), { ssr: false });
export const ProjectPublications = dynamic(() => import('@/components/public-browsing/ProjectPublications'), { ssr: false });
export const ContestWorkspaceList = dynamic(() => import('./CollaborationContestList'), { ssr: false });
export const ProjectSelection = dynamic(() => import('./CollaborationProjectList'), { ssr: false });
