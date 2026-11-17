import CommunityEntry from'@/components/public-browsing/CommunityEntry';
import{publicList,publicBrowsingEnabled}from'@/lib/publicContentServer';import{publicMetadata}from'@/lib/publicMetadata';import{PublicCollection}from'@/components/public-browsing/PublicViews';import{notFound}from'next/navigation';
export const dynamic='force-dynamic';export const metadata=publicMetadata('커뮤니티 · CBGPU','작성자가 공개한 글만 로그인 없이 확인하세요. 학교 내부 대화와 비공개 작성자 정보는 공개하지 않습니다.','/community');
export default async function Page({searchParams}:{searchParams:Promise<{query?:string}>}){if(!publicBrowsingEnabled)notFound();const query=(await searchParams).query||'',result=await publicList('community',24,query);return <CommunityEntry><PublicCollection kind="community" result={result} query={query}/></CommunityEntry>}
