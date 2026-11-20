import type {Metadata} from 'next';
import Link from 'next/link';
import {studioHandoffConfig,studioOpaquePattern,studioProjectPattern} from '@/lib/studioHandoff';
import StudioOpenConfirmation from './StudioOpenConfirmation';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'TeacherStudio 연결',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function StudioOpenPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const{id}=await params,query=await searchParams;
 const challenge=typeof query.challenge==='string'?query.challenge:'';
 const valid=studioProjectPattern.test(id)&&studioOpaquePattern.test(challenge)&&Object.keys(query).every(key=>key==='challenge');
 const config=studioHandoffConfig(process.env);
 return <section className="cb-page-content mx-auto max-w-lg space-y-5 py-8">
  <header><h1 className="cb-page-title">TeacherStudio 연결</h1><p className="cb-page-sub mt-2">CBGPU 계정으로 프로젝트를 열어요.</p></header>
  {valid?<StudioOpenConfirmation projectId={id} challenge={challenge} allowedOrigin={config?.projectId===id?config.publicOrigin:null}/>:<p role="alert" className="text-sm">연결 요청을 확인하지 못했어요. TeacherStudio에서 다시 열어 주세요.</p>}
  <Link href={studioProjectPattern.test(id)?'/server/'+id:'/server'} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">프로젝트로 돌아가기</Link>
 </section>;
}
