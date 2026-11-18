import {notFound} from 'next/navigation';
import NotebookFrame from '@/components/schools/NotebookFrame';
export const metadata={title:'Jupyter · CBGPU',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function NotebookPage({params}:{params:Promise<{jobId:string}>}){const{jobId}=await params;if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(jobId))notFound();return <NotebookFrame jobId={jobId}/>}
