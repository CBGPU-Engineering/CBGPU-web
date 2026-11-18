import SchoolAdministration from '@/components/schools/SchoolAdministration';
import {SchoolFeatureBoundary} from '@/components/schools/SchoolFeatureBoundary';
export const metadata={title:'Manage school · CBGPU Admin',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')return <SchoolFeatureBoundary/>;
 const{id}=await params;
 return <div className="cb-school-page"><SchoolAdministration schoolId={id} platform showSectionNavigation={false}/></div>;
}
