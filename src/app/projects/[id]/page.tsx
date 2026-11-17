import{publicDetail,publicBrowsingEnabled}from'@/lib/publicContentServer';
import{publicMetadata}from'@/lib/publicMetadata';
import{publicLabel}from'@/lib/publicContentModel';
import{PublicDetail,PublicUnavailable}from'@/components/public-browsing/PublicViews';
import{notFound}from'next/navigation';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const{id}=await params,result=await publicDetail('projects',id);return result.ok&&result.data.item?publicMetadata(publicLabel(result.data.item)+' · CBGPU',String(result.data.item.summary||''),'/projects/'+id):publicMetadata('공개 프로젝트 · CBGPU','공개된 프로젝트 소개만 확인할 수 있어요.','/projects/'+id,false)}
export default async function Page({params}:{params:Promise<{id:string}>}){if(!publicBrowsingEnabled)notFound();const{id}=await params,result=await publicDetail('projects',id);if(!result.ok)return result.status===404?notFound():<section className="cb-public-page"><PublicUnavailable/></section>;if(!result.data.item)notFound();return <PublicDetail kind="projects" item={result.data.item}/>}
