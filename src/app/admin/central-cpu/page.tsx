import PlatformCPUPool from'@/components/schools/PlatformCPUPool';
import{SchoolFeatureBoundary}from'@/components/schools/SchoolFeatureBoundary';
export const metadata={title:'Central CPU host pool · CBGPU Admin',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1'||process.env.NEXT_PUBLIC_CBGPU_CENTRAL_CPU_V1!=='1')return <SchoolFeatureBoundary/>;return <PlatformCPUPool/>}
