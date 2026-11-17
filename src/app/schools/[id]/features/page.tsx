import SchoolFeatureRequests from'@/components/schools/SchoolFeatureRequests';
import{SchoolFeatureBoundary}from'@/components/schools/SchoolFeatureBoundary';
import'@/components/schools/schools.css';
export const metadata={title:'학교 전용 기능 추가하기 · CBGPU',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;const{id}=await params;return <main className="cb-school-page"><SchoolFeatureRequests schoolId={id}/></main>}
