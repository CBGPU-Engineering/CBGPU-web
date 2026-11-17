'use client';
import{useState}from'react';
import Link from'next/link';
import{useAuth}from'@/lib/useAuth';
import{selectAccountSchool}from'@/lib/schoolsClient';
import{schoolLifeReadiness}from'@/lib/schoolLifeReadiness';
import type{SchoolLifeSources}from'@/lib/schoolLifeSettings';
import{isNativeAppHint}from'@/lib/nativeBridge';
import{Button}from'@/components/ui/button';
import{useSchoolScope}from'./SchoolScope';
export default function SchoolLifeReadiness({source}:{source:SchoolLifeSources}){
 const{user}=useAuth(),scope=useSchoolScope(),[busy,setBusy]=useState(false),[error,setError]=useState(''),readiness=schoolLifeReadiness(source);
 const member=scope.memberships.some(m=>m.school_id===source.school_id&&m.verified&&m.status==='ACTIVE'&&m.school.status==='APPROVED');
 async function open(path:'/meal'|'/timetable'){if(!user||busy||!member)return;setBusy(true);setError('');try{const selected=await selectAccountSchool(source.school_id,user.id);window.dispatchEvent(new CustomEvent('cbgpu-school-changed',{detail:{school_id:selected}}));const target=new URL(path,location.origin);if(isNativeAppHint())target.searchParams.set('native','1');window.location.assign(target.pathname+target.search)}catch{setError('The school selection or your current membership could not be confirmed. Your account and existing work are unchanged.');setBusy(false)}}
 return <section className="space-y-3" aria-label="School life next steps"><h3 className="font-semibold">What works next?</h3><p className="text-sm text-muted-foreground">Configuration is not proof of a successful provider response. Only a verified member can select this school and open its own timetable or meals.</p>{error&&<p role="alert">{error}</p>}<div className="grid gap-3 sm:grid-cols-2">{([{key:'meal',label:'Meals',path:'/meal'},{key:'timetable',label:'Timetable',path:'/timetable'}]as const).map(item=>{const state=readiness[item.key];return <article key={item.key} className="rounded-xl border p-4 space-y-2"><h4>{item.label}: {state.title}</h4><p className="text-sm">{state.detail}</p>{state.canOpen&&member?<Button type="button" variant="outline" disabled={busy} onClick={()=>void open(item.path)}>{busy?'Selecting school…':'Select this school and open '+item.label.toLowerCase()}</Button>:state.canOpen?<p className="text-sm">Verified school membership is required to open this workspace.</p>:state.state==='DISABLED'?<Button asChild variant="outline"><Link href={'/schools/'+encodeURIComponent(source.school_id)+'/admin?section=features'}>Open school configuration</Link></Button>:<Button asChild variant="outline"><Link href={'/schools/'+encodeURIComponent(source.school_id)+'/features'}>Request integration review</Link></Button>}</article>})}</div></section>
}
