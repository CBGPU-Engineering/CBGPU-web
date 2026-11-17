import{notFound}from'next/navigation';import MessageCenter from'@/components/schools/MessageCenter';
export const metadata={title:'커뮤니티 · CBGPU',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1!=='1')notFound();return <MessageCenter/>}
