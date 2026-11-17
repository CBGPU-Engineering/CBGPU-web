import Link from 'next/link';
import SchoolGuestAccess from '@/components/schools/SchoolGuestAccess';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
import '@/components/schools/schools.css';
export const metadata={title:'Temporary guest access · CBGPU',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){
 if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;
 const {id}=await params;
 return <div className="cb-school-page"><Link href="/schools" className="cb-school-help">← My schools</Link><div className="mt-6"><SchoolGuestAccess schoolId={id}/></div></div>;
}
