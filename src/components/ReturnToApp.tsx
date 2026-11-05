'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {siteHref} from '@/lib/siteHref';
const KEY='cbgpu-return-to-app';
/**
 * 앱 웹뷰에서 관리·프린터·레이저 사이트로 넘어왔을 때 앱으로 돌아가는 버튼.
 * 이 호스트들에는 네이티브 브리지가 주입되지 않아 앱 여부를 알 수 없으므로, 앱 메뉴가 붙인 ?from=app 을 sessionStorage에 기억한다.
 */
export default function ReturnToApp(){
 const [show,setShow]=useState(false);
 useEffect(()=>{
  try{
   const url=new URL(location.href);
   if(url.searchParams.get('from')==='app'){sessionStorage.setItem(KEY,'1');url.searchParams.delete('from');history.replaceState(null,'',url.pathname+url.search+url.hash)}
   setShow(sessionStorage.getItem(KEY)==='1');
  }catch{}
 },[]);
 if(!show)return null;
 return <a href={siteHref('https://app.cbgpu.com/')} onClick={()=>{try{sessionStorage.removeItem(KEY)}catch{}}} className="fixed left-3 z-[90] inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-lg" style={{bottom:'calc(12px + env(safe-area-inset-bottom))'}}><ArrowLeft size={16}/>CBGPU 앱으로</a>;
}
