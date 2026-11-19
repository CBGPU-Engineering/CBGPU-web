import Link from 'next/link';
import {BookOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import SchoolApplicationEditor from '@/components/schools/SchoolApplicationEditor';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
import '@/components/schools/schools.css';
export const metadata={title:'학교 도입 신청 · CBGPU',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{catalog_school_id?:string}>}){const query=await searchParams;const raw=query.catalog_school_id;const catalogSchoolId=typeof raw==='string'&&/^[-A-Za-z0-9_]{1,100}$/.test(raw)?raw:undefined;if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;return <main className="cb-school-page"><Button asChild variant="outline" className="mb-6"><Link href="/docs/school-integration"><BookOpen className="size-4"/>처음이라면 학교 도입 가이드</Link></Button><SchoolApplicationEditor catalogSchoolId={catalogSchoolId}/></main>}
