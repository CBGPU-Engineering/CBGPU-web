import SchoolApplicationEditor from '@/components/schools/SchoolApplicationEditor';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
import '@/components/schools/schools.css';
export const metadata={title:'학교 도입 신청 · CBGPU',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;return <main className="cb-school-page"><SchoolApplicationEditor/></main>}
