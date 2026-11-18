'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useSchoolScope} from '@/components/schools/SchoolScope';
import SchoolGpuResources from '@/components/schools/SchoolGpuResources';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/product-motion';
import {schoolGpuBookingTarget,schoolGpuBookingHref} from '@/lib/schoolGpuRouting';
import {resourceAllowed,resourceReason} from '@/lib/schoolResourceContext';
export default function SchoolComputePage(){
 const scope=useSchoolScope(),resource=scope.resource,router=useRouter();
 const target=schoolGpuBookingTarget('/compute',resource,scope.status==='legacy');
 useEffect(()=>{if(target)router.replace(schoolGpuBookingHref(target,window.location.search))},[target,router]);
 if(target||resource.status==='loading'||resource.status==='legacy'&&scope.status==='loading')return <p role="status" className="cb-school-page">학교 GPU 예약 화면을 열고 있어요.</p>;
 if(resource.status==='unavailable')return <section className="cb-school-page"><EmptyState kind="permission" title="학교의 GPU 이용 정보를 확인하지 못했어요" description="학교를 임의로 바꾸지 않고 다시 확인할게요." action={<Button variant="outline" onClick={()=>void resource.refresh()}>다시 확인하기</Button>}/></section>;
 const current=resource.status==='ready'?resource.current:null;
 if(!current)return <section className="cb-school-page"><EmptyState kind="permission" title="GPU를 이용할 학교를 선택해 주세요" description="계정에 연결된 학교나 승인받은 임시 자원을 선택하면 해당 학교의 예약 화면이 열려요." action={<Button asChild><Link href="/schools">학교 선택하기</Link></Button>}/></section>;
 if(!current.school.features.includes('gpu_compute')||!resourceAllowed(current,resource.access,'gpu',resource.serverNow))return <section className="cb-school-page"><EmptyState kind="permission" title="선택한 학교의 GPU 이용 권한이 필요해요" description={resourceReason(!current.school.features.includes('gpu_compute')?'FEATURE_DISABLED':resource.access?.reasons.gpu)} action={<Button variant="outline" onClick={()=>void resource.refresh()}>이용 권한 다시 확인</Button>}/></section>;
 return <div className="cb-school-page"><p className="text-sm text-muted-foreground mb-5">{current.school.display_name} · GPU 예약</p><SchoolGpuResources schoolId={current.school_id}/></div>;
}
