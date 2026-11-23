'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Clock,Loader2,AlertCircle} from 'lucide-react';
import {ResourceStatus} from '@/components/ui/resource-motion';
import {SuccessFeedback} from '@/components/ui/product-motion';
/** The backend alone advances these phases. No elapsed-time estimates or percentages. */
export default function DeploymentFeedback({deployment}:{deployment:{id:string;status:string}}){
 const previous=useRef<{id:string;status:string}|null>(null),[completed,setCompleted]=useState('');
 useEffect(()=>{const old=previous.current;if(old?.id===deployment.id&&['queued','building'].includes(old.status)&&deployment.status==='ready')setCompleted(deployment.id);previous.current=deployment;},[deployment.id,deployment.status]);
 const phase=deployment.status==='queued'?0:deployment.status==='building'?1:deployment.status==='ready'?3:-1;
 return <section className="cb-deploy-real-progress" aria-label="최근 배포 처리 상태"><div className="cb-deploy-real-progress-heading"><strong>최근 배포</strong><ResourceStatus value={deployment.status}><span>{deployment.status==='queued'?'배포 순서를 기다리고 있어요':deployment.status==='building'?'저장소 코드를 빌드하고 있어요':deployment.status==='ready'?'배포를 마쳤어요':deployment.status==='error'?'배포를 마치지 못했어요':'배포 기록을 확인해 주세요'}</span></ResourceStatus></div>{phase>=0&&<ol>{['대기','빌드','배포'].map((label,index)=><li key={label} data-complete={phase>index} aria-current={phase===index?'step':undefined}><span aria-hidden="true">{phase>index?<Check size={14}/>:phase===index&&index===1?<Loader2 size={14} className="cb-deploy-spin"/>:<Clock size={14}/>}</span><span>{label}</span></li>)}</ol>}{deployment.status==='error'&&<p><AlertCircle size={15}/>로그에서 원인을 확인하고 다시 배포할 수 있어요.</p>}{completed===deployment.id&&deployment.status==='ready'&&<SuccessFeedback compact title="배포를 마쳤어요" description="사이트를 열어 변경사항을 확인해 주세요."/>}</section>;
}
