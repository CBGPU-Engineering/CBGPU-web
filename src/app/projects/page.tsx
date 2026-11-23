import{publicList,publicBrowsingEnabled}from'@/lib/publicContentServer';
import{publicMetadata}from'@/lib/publicMetadata';
import{PublicCollection}from'@/components/public-browsing/PublicViews';
import{notFound}from'next/navigation';
export const dynamic='force-dynamic';
export const metadata=publicMetadata('공개 프로젝트 · CBGPU','작성자가 직접 공개한 프로젝트의 소개와 작업을 둘러보세요. 비공개 코드와 설정은 공개하지 않아요.','/projects');
export default async function Page({searchParams}:{searchParams:Promise<{query?:string}>}){if(!publicBrowsingEnabled)notFound();const query=(await searchParams).query||'',result=await publicList('projects',24,query);return <PublicCollection kind="projects" result={result} query={query}/>}
