'use client';
import type{ReactNode}from'react';
import{useCallback,useState}from'react';
import{useRouter}from'next/navigation';
import{overlay}from'overlay-kit';
import{useAuth}from'@/lib/useAuth';
import{safeAuthReturn}from'@/lib/authReturn';
import{Button}from'@/components/ui/button';
import{Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle}from'@/components/ui/dialog';
export function useAuthActionGuard(){const{user,isLoading}=useAuth();const run=useCallback(async(action:()=>void|Promise<void>,context:{returnTo?:string;label:string})=>{if(isLoading)return false;if(user){await action();return true;}const destination=safeAuthReturn(context.returnTo||window.location.pathname),trigger=document.activeElement as HTMLElement|null;
 overlay.open(({isOpen,close,unmount})=><Dialog open={isOpen} onOpenChange={value=>{if(!value)close()}}><DialogContent className="max-w-sm" onExitComplete={unmount} onCloseAutoFocus={event=>{if(trigger?.isConnected){event.preventDefault();trigger.focus()}}}><DialogHeader><DialogTitle>로그인하고 {context.label}</DialogTitle><DialogDescription>내용은 로그인 없이 볼 수 있어요. 이 작업은 내 계정과 이용 권한을 확인한 뒤 진행해요. 로그인 후에도 작업이 자동으로 실행되지 않아요.</DialogDescription></DialogHeader><div className="flex flex-col gap-3"><Button asChild><a href={'/auth/login?next='+encodeURIComponent(destination)} onClick={close}>로그인</a></Button><Button asChild variant="outline"><a href={'/auth/signup?next='+encodeURIComponent(destination)} onClick={close}>계정 만들기</a></Button><Button variant="ghost" onClick={close}>계속 둘러보기</Button></div></DialogContent></Dialog>);return false;},[user?.id,isLoading]);return{run,isLoading}}
export default function PublicActionLink({href,children,label,variant='default'}:{href:string;children:ReactNode;label:string;variant?:'default'|'outline'|'ghost'}){const{run,isLoading}=useAuthActionGuard(),router=useRouter(),[busy,setBusy]=useState(false);return <Button type="button" variant={variant} disabled={isLoading||busy} onClick={()=>{setBusy(true);void run(()=>router.push(safeAuthReturn(href)),{returnTo:href,label}).finally(()=>setBusy(false))}}>{children}</Button>}
