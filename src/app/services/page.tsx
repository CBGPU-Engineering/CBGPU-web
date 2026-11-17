'use client';
import KakaoPageAd from '@/components/ads/KakaoPageAd';
import {useSearchParams} from 'next/navigation';
import ServiceDirectory from '@/components/services/ServiceDirectory';
import {useWorkspaceAudience,useIsAppWorkspace} from '@/components/workspaces/WorkspaceShell';
export default function ServicesPage(){const mode=useWorkspaceAudience(),isApp=useIsAppWorkspace(),params=useSearchParams();return <div className="cb-service-page"><ServiceDirectory key={params.toString()} audience={mode} isApp={isApp} initialQuery={params.get('q')||''} initialCategory={params.get('category')||'all'}/><KakaoPageAd placement="platform" contentReady={!params.get('q')&&!params.get('category')}/></div>}
