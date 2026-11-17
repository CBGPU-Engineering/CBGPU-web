import SchoolDirectory from '@/components/schools/SchoolDirectory';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
import '@/components/schools/schools.css';
export const metadata={title:'학교 · CBGPU',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;return <main className="cb-school-page"><SchoolDirectory/></main>}
