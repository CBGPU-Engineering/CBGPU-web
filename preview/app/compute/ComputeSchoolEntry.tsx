'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Server } from 'lucide-react';
import { useSchoolScope } from '@/components/schools/SchoolScope';
import SchoolGpuResources from '@/components/schools/SchoolGpuResources';
import { resourceAllowed, resourceReason } from '@/lib/schoolResourceContext';
import { schoolGpuBookingHref, schoolGpuBookingTarget } from '@/lib/schoolGpuRouting';

export function ComputeSchoolEntry() {
  const { status, resource } = useSchoolScope();
  const router = useRouter();
  const target = schoolGpuBookingTarget('/compute', resource, status === 'legacy');

  useEffect(() => {
    if (target) router.replace(schoolGpuBookingHref(target, location.search));
  }, [router, target]);

  if (target || resource.status === 'loading' || (resource.status === 'legacy' && status === 'loading')) {
    return <p role="status" className="pv-compute-feedback">학교 GPU 이용 정보를 확인하고 있어요.</p>;
  }

  const current = resource.status === 'ready' ? resource.current : null;
  const feature = current?.school.features.includes('gpu_compute') === true;
  if (current && feature && resourceAllowed(current, resource.access, 'gpu', resource.serverNow)) {
    return <SchoolGpuResources schoolId={current.school_id} previewSchoolName={current.school.display_name} />;
  }

  const unavailable = resource.status === 'unavailable';
  const title = unavailable
    ? 'GPU 이용 정보를 확인하지 못했어요'
    : current ? '이 학교의 GPU를 이용할 수 없어요' : 'GPU를 이용할 학교를 선택해 주세요';
  return (
    <section className="pv-compute-feedback" aria-labelledby="gpu-access-heading">
      <Server size={26} aria-hidden="true" />
      <h2 id="gpu-access-heading">{title}</h2>
      {current ? <p>{resourceReason(feature ? resource.access?.reasons.gpu : 'FEATURE_DISABLED')}</p> :
        !unavailable && <p>계정에 연결된 학교나 승인받은 임시 자원을 선택해 주세요.</p>}
      {unavailable || current
        ? <button className="pv-primary" type="button" onClick={() => void resource.refresh()}>다시 확인하기</button>
        : <Link className="pv-primary" href="/schools">학교 찾기</Link>}
    </section>
  );
}
