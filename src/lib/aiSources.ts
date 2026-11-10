import 'server-only';
import {aiUserClient,AiFailure} from './aiServer';
import {preprintsClient} from './preprintsServer';
import {guides} from '@/components/publications/docs';
export type AiSource={id:string;label:string;href:string;text:string;snippet:string};
export async function aiSources(token:string,scope='all'):Promise<AiSource[]>{
 if(!['all','materials','notes','papers','docs'].includes(scope))throw new AiFailure('검색 범위를 확인해 주세요.');
 const client=aiUserClient(token),sources:AiSource[]=[];
 const tasks=[];
 if(scope==='all'||scope==='notes')tasks.push((async()=>{const {data,error}=await client.from('research_notes').select('id,title,content').order('updated_at',{ascending:false}).limit(150);if(error)throw new AiFailure('노트 검색 권한을 확인하지 못했어요.',503);for(const n of data||[])sources.push({id:'note:'+n.id,label:n.title,href:'/notes?note='+n.id,text:(n.title+'\n'+n.content).slice(0,8000),snippet:n.content.slice(0,250)})})());
 if(scope==='all'||scope==='materials')tasks.push((async()=>{const {data,error}=await client.from('shared_materials').select('id,title,file_name,tags').eq('status','ready').order('created_at',{ascending:false}).limit(150);if(error)throw new AiFailure('공유자료 검색 권한을 확인하지 못했어요.',503);for(const m of data||[])sources.push({id:'material:'+m.id,label:m.title,href:'/materials/'+m.id,text:[m.title,m.file_name,...(m.tags||[])].join(' '),snippet:[m.file_name,...(m.tags||[])].join(' · ')})})());
 if(scope==='all'||scope==='papers')tasks.push((async()=>{const {data,error}=await preprintsClient().from('preprints').select('id,title,abstract').eq('status','published').order('published_at',{ascending:false}).limit(100);if(error)throw new AiFailure('공개 논문을 검색하지 못했어요.',503);for(const p of data||[])sources.push({id:'paper:'+p.id,label:p.title,href:'https://arxiv.cbgpu.com/'+p.id,text:(p.title+'\n'+p.abstract).slice(0,8000),snippet:p.abstract.slice(0,250)})})());
 if(scope==='all'||scope==='docs')for(const g of guides)sources.push({id:'doc:'+g.slug,label:g.title,href:'https://docs.cbgpu.com/'+g.slug,text:JSON.stringify(g).slice(0,8000),snippet:g.description});
 await Promise.all(tasks);let bytes=0;return sources.slice(0,500).map(s=>({...s,text:s.text.slice(0,3000)})).filter(s=>{bytes+=Buffer.byteLength(JSON.stringify(s));return bytes<2400000});
}
