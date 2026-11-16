'use client';
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useTheme} from 'next-themes';
import {onNativeBridgeReady} from '@/lib/nativeBridge';
import type {WorkspaceId} from '@/lib/workspaces';

/** New apps own native navigation; older APKs and browsers keep the web bar. */
export default function NativeNavigationSync({mode,visible=true}:{mode:WorkspaceId;visible?:boolean}){
 const pathname=usePathname(),router=useRouter(),{resolvedTheme}=useTheme();
 useEffect(()=>()=>{delete document.documentElement.dataset.cbgpuNativeNavigation;delete window.__cbgpuNativeNavigationTarget;void window.CBGPUNative?.setNavigation?.({visible:false}).catch(()=>{})},[]);
 useEffect(()=>{
  let live=true,frame=0,observer:MutationObserver|undefined,accepted=false,lastModal:boolean|undefined;
  const navigate=(path:string)=>{if(!/^\/(?:\?(?:mode=student|mode=researcher))?$|^\/(?:ai|study|dashboard|services|profile)$/.test(path))return;window.__cbgpuNativeNavigationTarget=new URL(path,location.href).href;router.push(path)};
  const previous=window.__cbgpuNativeNavigate;window.__cbgpuNativeNavigate=navigate;
  const cancel=onNativeBridgeReady(bridge=>{
   if(!bridge.setNavigation)return;
   const color=(value:string)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');if(!context)throw Error('Color conversion unavailable');context.fillStyle=value;context.fillRect(0,0,1,1);const [r,g,b,a]=context.getImageData(0,0,1,1).data;return ((a<<24)|(r<<16)|(g<<8)|b)>>>0};
   const modal=()=>!!document.querySelector('[role="dialog"][data-state="open"],dialog[open],[data-study-request-dialog]');
   async function sync(){
    frame=0;if(!live||!bridge.setNavigation)return;
    const blocked=modal();lastModal=blocked;
    try{
     const nav=document.querySelector<HTMLElement>('.cb-app .cb-bottom-nav'),links=nav?[...nav.querySelectorAll<HTMLAnchorElement>('a[href]')]:[];
     if(!visible||blocked||!nav||links.length<2){await bridge.setNavigation({visible:false});if(live){accepted=true;document.documentElement.dataset.cbgpuNativeNavigation='true'}return;}
     const style=getComputedStyle(nav),root=getComputedStyle(document.documentElement),workspace=getComputedStyle(nav.closest('.cb-workspace')||nav);
     const selected=links.findIndex(a=>a.classList.contains('active'));
     // Some secondary features have no selected primary tab. Keep the existing
     // web bar there rather than falsely selecting Home in older native clients.
     if(selected<0){await bridge.setNavigation({visible:false});if(live)delete document.documentElement.dataset.cbgpuNativeNavigation;return;}
     const active=links[selected];
     const payload={visible:true,tabs:links.map(a=>{const u=new URL(a.href);return {path:u.pathname+u.search,label:a.querySelector('span')?.textContent||'',svg:a.querySelector('svg')?.outerHTML||'<svg/>'}}),selected,
      background:color(style.backgroundColor),foreground:color(root.color),muted:color(getComputedStyle(links.find((_,i)=>i!==selected)||active).color),border:color(style.borderTopColor),accent:color(workspace.getPropertyValue('--workspace-accent')||getComputedStyle(active).color),selectedBackground:color(getComputedStyle(active,'::before').backgroundColor)};
     await bridge.setNavigation(payload);if(live){accepted=true;document.documentElement.dataset.cbgpuNativeNavigation='true'}
    }catch{if(live&&!accepted)delete document.documentElement.dataset.cbgpuNativeNavigation;}
   }
   const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>void sync())};schedule();
   observer=new MutationObserver(()=>{if(modal()!==lastModal)schedule()});
   observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state','open']});
  });
  return()=>{live=false;cancel();observer?.disconnect();cancelAnimationFrame(frame);if(window.__cbgpuNativeNavigate===navigate)window.__cbgpuNativeNavigate=previous;};
 },[pathname,mode,resolvedTheme,visible,router]);
 return null;
}
