import type{MetadataRoute}from'next';
import{publicBrowsingEnabled}from'@/lib/publicContentServer';
import{fetchPublicContent}from'@/lib/publicContentServer';
import{publicDestinations}from'@/lib/publicContentModel';
const siteUrl='https://cbgpu.com';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const staticPaths=['/','/contact','/services','/download','/privacy'];if(publicBrowsingEnabled)staticPaths.push('/projects','/explore/contests','/community','/explore/schools','/explore/services/school','/explore/services/projects','/explore/services/ai','/explore/services/gpu');const entries:MetadataRoute.Sitemap=staticPaths.map(path=>({url:siteUrl+(path==='/'?'':path),changeFrequency:path==='/'?'daily':'weekly',priority:path==='/'?1:.6}));if(!publicBrowsingEnabled)return entries;
 for(const kind of ['projects','contests','schools']as const){for(let offset=0;offset<=10000;offset+=100){const reply=await fetchPublicContent([kind],new URLSearchParams({limit:'100',offset:String(offset)}));if(!reply.ok||!('items'in reply.data))break;for(const item of reply.data.items){const modified=typeof item.updated_at==='string'?new Date(item.updated_at):undefined;entries.push({url:siteUrl+publicDestinations[kind]+'/'+encodeURIComponent(item.id),...(modified&&!Number.isNaN(modified.getTime())?{lastModified:modified}:{}),changeFrequency:'weekly',priority:.5})}if(!reply.data.items.length||offset+100>=reply.data.total)break;}}
 return entries;
}
