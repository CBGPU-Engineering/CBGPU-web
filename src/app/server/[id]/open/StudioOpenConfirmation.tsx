'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {studioLoginReturn,studioRedeemDestination} from '@/lib/studioHandoff';
import {AuthFlowLink} from '@/components/auth/AuthFlowLink';
import {Button} from '@/components/ui/button';
export default function StudioOpenConfirmation({projectId,challenge,allowedOrigin}:{projectId:string;challenge:string;allowedOrigin:string|null}){
 const{user,isLoading}=useAuth(),[pending,setPending]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),request=useRef<AbortController|null>(null),busy=useRef(false);
 useEffect(()=>{generation.current++;setError('');setPending(false);busy.current=false;return()=>{generation.current++;request.current?.abort()}},[user?.id,projectId,challenge]);
 async function confirm(){
  if(!user||busy.current)return;
  busy.current=true;setPending(true);setError('');const owner=user.id,version=generation.current;
  const controller=new AbortController();request.current=controller;
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
   const work=async()=>{
   const session=(await supabase.auth.getSession()).data.session;
   if(controller.signal.aborted)throw Error('연결 시간이 지났어요. 앱에서 다시 시작해 주세요.');
   if(!session||session.user.id!==owner)throw Error('로그인 상태가 바뀌었어요. 다시 로그인한 뒤 연결해 주세요.');
   const response=await fetch('/api/server/'+projectId+'/open',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({challenge}),cache:'no-store',redirect:'error',signal:controller.signal});
   const value=await response.json().catch(()=>null);
   if(!response.ok)throw Error(response.status===403?'프로젝트 소유자·편집자 권한과 서버 이용 권한을 확인해 주세요.':response.status===401?'다시 로그인한 뒤 연결해 주세요.':'앱 연결을 준비하지 못했어요. TeacherStudio에서 다시 시작해 주세요.');
   const target=studioRedeemDestination(value?.url,allowedOrigin);
   if(!target)throw Error('안전한 연결 주소를 확인하지 못했어요. TeacherStudio에서 다시 시작해 주세요.');
   if((await supabase.auth.getSession()).data.session?.user.id!==owner)throw Error('계정이 바뀌었어요. 현재 계정에서 다시 연결해 주세요.');
   if(version===generation.current&&!controller.signal.aborted)window.location.assign(target);
   };
   const interrupted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('연결 확인이 지연되고 있어요. TeacherStudio에서 다시 시작해 주세요.')),{once:true}));
   await Promise.race([work(),interrupted]);
  }catch(reason){if(version===generation.current)setError(reason instanceof Error?reason.message:'앱 연결을 확인하지 못했어요. 다시 시도해 주세요.')}
  finally{clearTimeout(timer);if(version===generation.current){busy.current=false;setPending(false)}}
 }
 if(isLoading)return <p role="status" className="text-sm text-muted-foreground">로그인 상태를 확인하고 있어요.</p>;
 if(!user)return <div className="space-y-4"><p className="text-sm">로그인한 뒤 연결할 계정을 확인해 주세요.</p><Button asChild><AuthFlowLink href={'/auth/login?next='+encodeURIComponent(studioLoginReturn(projectId,challenge))}>로그인하고 연결하기</AuthFlowLink></Button></div>;
 return <div className="space-y-4 rounded-xl border border-border bg-card p-5">
  <p className="text-sm leading-relaxed">현재 로그인한 계정으로 TeacherStudio를 열까요? 프로젝트 소유자와 편집자로 참여한 구성원만 사용할 수 있어요.</p>
  <Button onClick={()=>void confirm()} disabled={pending} className="w-full">{pending?'연결 권한 확인 중…':'확인하고 TeacherStudio 열기'}</Button>
  <p className="text-sm text-muted-foreground">앱을 여는 데 필요한 권한을 확인한 뒤 이동해요.</p>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </div>;
}
