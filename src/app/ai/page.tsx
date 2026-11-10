import {Suspense} from 'react';
import AiWorkspace from '@/components/ai/AiWorkspace';
export default function AiPage(){return <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">AI를 불러오는 중…</p>}><AiWorkspace/></Suspense>}
