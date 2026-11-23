import SchoolAdminEntry from '@/components/schools/SchoolAdminEntry';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
import '@/components/schools/schools.css';

export const metadata={title:'학교 관리자 · CBGPU',robots:{index:false,follow:false}};
export default function Page(){return process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?<SchoolAdminEntry/>:<SchoolFeatureBoundary/>;}
