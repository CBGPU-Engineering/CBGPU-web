import PlatformSchoolApplications from '@/components/schools/PlatformSchoolApplications';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
export const metadata={title:'School applications · CBGPU Admin',robots:{index:false,follow:false}};
export default function Page(){return process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?<PlatformSchoolApplications/>:<SchoolFeatureBoundary/>}
