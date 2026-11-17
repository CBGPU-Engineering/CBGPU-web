import PlatformFeatureRequests from '@/components/schools/PlatformFeatureRequests';
export const metadata={title:'School feature requests · CBGPU Admin',robots:{index:false,follow:false}};
export default function Page(){return process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?<PlatformFeatureRequests/>:<section><h1>School feature requests</h1><p>School administration is not enabled.</p></section>}
