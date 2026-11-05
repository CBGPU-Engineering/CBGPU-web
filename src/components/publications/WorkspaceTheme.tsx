'use client';
import {useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {Monitor,Moon,Sun} from 'lucide-react';
export function WorkspaceTheme({children}:{children:React.ReactNode}){const [resolvedTheme,setResolvedTheme]=useState('light');useEffect(()=>{const sync=()=>setResolvedTheme(document.documentElement.classList.contains('dark')?'dark':'light');sync();const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[]);return <div className="admin-developer-shell portal-publications" data-theme={resolvedTheme||'light'}>{children}</div>}
export function WorkspaceThemeControl(){
 const {theme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 // 기본 <select>는 안드로이드 웹뷰에서 시스템 선택창(앱 폰트와 다른 흰 창)을 띄우고 좁은 폭에서 글자가 잘려서, 누를 때마다 시스템→라이트→다크로 바뀌는 아이콘 버튼으로 바꿨다.
 const current=mounted?(theme||'system'):'system',order=['system','light','dark'],next=order[(order.indexOf(current)+1)%3];
 const label={system:'System',light:'Light',dark:'Dark'}[current as 'system'|'light'|'dark']||'System';
 const Icon=current==='light'?Sun:current==='dark'?Moon:Monitor;
 return <button type="button" className="theme-control" aria-label={`Color theme: ${label}. Switch to ${next}`} title={`Theme: ${label}`} onClick={()=>setTheme(next)}><Icon className="icon" strokeWidth={1.6}/></button>;
}
