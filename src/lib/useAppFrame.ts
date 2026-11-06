'use client';
import {useEffect,useState} from 'react';
export const APP_FLAG='cbgpu-return-to-app';
/**
 * 앱 틀(상단 공간 메뉴·하단 탭)로 보여 줄지. 서버가 Android 웹뷰('; wv)')를 알아봤거나(server=true),
 * 앱 공간 메뉴가 붙인 ?from=app을 이 탭이 기억하고 있으면 true. 데스크톱 브라우저에서 앱 화면을 테스트할 때도 같은 틀이 보인다.
 */
export function useAppFrame(server:boolean){
 const [flag,setFlag]=useState(false);
 useEffect(()=>{try{
  if(new URL(location.href).searchParams.get('from')==='app')sessionStorage.setItem(APP_FLAG,'1');
  if(/;\s*wv\)/.test(navigator.userAgent))sessionStorage.setItem(APP_FLAG,'1');
  setFlag(sessionStorage.getItem(APP_FLAG)==='1');
 }catch{}},[]);
 return server||flag;
}
