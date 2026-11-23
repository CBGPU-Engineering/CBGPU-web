import {AdminText} from '@/components/admin/admin-language';
import PlatformFeatureRequests from '@/components/schools/PlatformFeatureRequests';
export const metadata={title:'School feature requests · CBGPU Admin',robots:{index:false,follow:false}};
export default function Page(){return process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?<PlatformFeatureRequests/>:<section><h1><AdminText>School feature requests</AdminText></h1><p><AdminText>School administration is not enabled.</AdminText></p></section>}
