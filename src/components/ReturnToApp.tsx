'use client';
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {APP_FLAG} from '@/lib/useAppFrame';
/**
 * 앱 웹뷰에서 관리 사이트로 처음 들어올 때만 하는 일: 앱에서 왔다는 표시(?from=app)를 기억하고 주소에서 지우며,
 * 로그인 뒤 서버가 보내는 일반 관리 화면(/admin/gpu)이 아니라 폰 화면(/admin/m)으로 한 번 안내한다.
 * 앱으로 돌아가는 길은 상단 공간 메뉴(AppSpaceFrame)가 맡으므로 화면에는 아무것도 그리지 않는다.
 */
export default function ReturnToApp(){
 const pathname=usePathname(),router=useRouter();
 useEffect(()=>{
  try{
   const url=new URL(location.href);
   if(url.searchParams.get('from')==='app'){sessionStorage.setItem(APP_FLAG,'1');url.searchParams.delete('from');history.replaceState(null,'',url.pathname+url.search+url.hash)}
   const inApp=/;\s*wv\)/.test(navigator.userAgent);
   if(inApp)sessionStorage.setItem(APP_FLAG,'1');
   if(inApp&&location.hostname==='admin.cbgpu.com'&&['/admin/gpu','/admin'].includes(location.pathname)&&!sessionStorage.getItem('cbgpu-m-landed')){sessionStorage.setItem('cbgpu-m-landed','1');router.replace('/admin/m')}
  }catch{}
 },[pathname,router]);
 return null;
}
