import{publicMetadata}from'@/lib/publicMetadata';
import HomeEntry from '@/components/public-browsing/HomeEntry';
export default function Home(){return <HomeEntry/>}

export const metadata=process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'?publicMetadata('CBGPU — 학교와 프로젝트를 이어가는 공간','공개 프로젝트와 대회, 커뮤니티를 둘러보고 내 계정으로 학교생활과 연구·개발을 이어가세요.','/'):{};
