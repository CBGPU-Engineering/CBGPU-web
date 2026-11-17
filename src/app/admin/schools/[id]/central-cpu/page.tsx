import SchoolCPUAllocation from'@/components/schools/SchoolCPUAllocation';
import{SchoolFeatureBoundary}from'@/components/schools/SchoolFeatureBoundary';
export const metadata={title:'Central CPU allocation · CBGPU Admin',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1'||process.env.NEXT_PUBLIC_CBGPU_CENTRAL_CPU_V1!=='1')return <SchoolFeatureBoundary/>;const{id}=await params;return <SchoolCPUAllocation schoolId={id}/>}
