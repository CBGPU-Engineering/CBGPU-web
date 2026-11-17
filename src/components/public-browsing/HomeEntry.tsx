import{headers}from'next/headers';
import WorkspaceHome from'@/components/workspaces/WorkspaceHome';
import{PublicHome}from'./PublicViews';
import PublicHomeSwitch from'./PublicHomeSwitch';
export default async function HomeEntry(){if(process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1!=='1')return <WorkspaceHome/>;const request=await headers();const hint=/(?:^|;)\s*sb-cbgpu-auth-token(?:\.\d+)?=/.test(request.get('cookie')||'');return <PublicHomeSwitch sessionHint={hint}><PublicHome/></PublicHomeSwitch>}
