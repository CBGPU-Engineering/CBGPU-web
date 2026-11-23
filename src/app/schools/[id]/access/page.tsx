import Link from 'next/link';
import SchoolGuestAccess from '@/components/schools/SchoolGuestAccess';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
import '@/components/schools/schools.css';
export const metadata={title:'외부 협업자 이용 요청 · CBGPU',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){
 if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;
 const {id}=await params;
 return <div className="cb-school-page"><Link href="/schools" className="cb-school-help">← 내 학교</Link><div className="mt-6"><SchoolGuestAccess schoolId={id}/></div></div>;
}
