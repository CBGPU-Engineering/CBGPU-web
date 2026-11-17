import{notFound}from'next/navigation';import ProjectPublications from'@/components/public-browsing/ProjectPublications';
export const metadata={title:'내 프로젝트 소개 · CBGPU',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1!=='1')notFound();return <ProjectPublications/>}
