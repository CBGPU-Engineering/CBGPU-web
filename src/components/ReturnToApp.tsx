'use client';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {siteHref} from '@/lib/siteHref';
const KEY='cbgpu-return-to-app';
/**
 * 앱 웹뷰에서 관리·프린터·레이저 사이트로 넘어왔을 때 앱으로 돌아가는 버튼.
 * 이 호스트들에는 네이티브 브리지가 주입되지 않아 앱 여부를 알 수 없으므로, 앱 메뉴가 붙인 ?from=app 을 sessionStorage에 기억한다.
 */
export default function ReturnToApp(){
 const [show,setShow]=useState(false),pathname=usePathname(),router=useRouter();
 useEffect(()=>{
  try{
   const url=new URL(location.href);
   if(url.searchParams.get('from')==='app'){sessionStorage.setItem(KEY,'1');url.searchParams.delete('from');history.replaceState(null,'',url.pathname+url.search+url.hash)}
   // Android 앱 웹뷰는 UA에 '; wv)'가 들어간다. 로그인 뒤 서버가 '/'를 /admin/gpu로 돌려보내 ?from=app이 사라지므로, UA로도 앱을 알아본다.
   const inApp=/;\s*wv\)/.test(navigator.userAgent);
   if(inApp)sessionStorage.setItem(KEY,'1');
   setShow(sessionStorage.getItem(KEY)==='1');
   // 앱에서 관리 사이트에 들어오면 처음 한 번은 폰 전용 화면으로 보낸다(이후 전체 관리 화면으로 가는 건 막지 않는다).
   if(inApp&&location.hostname==='admin.cbgpu.com'&&['/admin/gpu','/admin'].includes(location.pathname)&&!sessionStorage.getItem('cbgpu-m-landed')){sessionStorage.setItem('cbgpu-m-landed','1');router.replace('/admin/m')}
  }catch{}
 },[]);
 // 폰 전용 관리 화면(/admin/m)은 상단 공간 메뉴에서 앱으로 돌아가므로 이 버튼을 쓰지 않는다.
 if(!show||pathname==='/admin/m'||pathname.startsWith('/admin/m/'))return null;
 return <a href={siteHref('https://app.cbgpu.com/')} onClick={()=>{try{sessionStorage.removeItem(KEY)}catch{}}} className="fixed left-3 z-[90] inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-lg" style={{bottom:'calc(12px + env(safe-area-inset-bottom))'}}><ArrowLeft size={16}/>CBGPU 앱으로</a>;
}
