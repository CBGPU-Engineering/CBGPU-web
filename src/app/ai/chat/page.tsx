import {redirect} from 'next/navigation';
export default async function LegacyChat({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const query=new URLSearchParams();for(const [k,v] of Object.entries(params))if(typeof v==='string')query.set(k,v);redirect('/ai'+(query.size?'?'+query:''))}
