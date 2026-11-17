'use client';
import{useEffect,useState,type ReactNode}from'react';
import{useAuth}from'@/lib/useAuth';
import MessageCenter from'@/components/schools/MessageCenter';
/** Only the public curated server children render before authentication settles.
 * Member reads are owned by MessageCenter's fresh, scoped APIs; no private SSR DTO is sent. */
export default function CommunityEntry({children}:{children:ReactNode}){
 const{user,isLoading}=useAuth();
 const[confirmedOwner,setConfirmedOwner]=useState<string|null>(null);
 useEffect(()=>{if(!user||!isLoading)setConfirmedOwner(user?.id||null)},[user?.id,isLoading]);
 // A token refresh for the same settled owner must not unmount unsent drafts.
 // An initial or changed identity still sees only the public server content.
 const settled=user&&(!isLoading||confirmedOwner===user.id);
 return process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'&&settled?<MessageCenter key={user.id}/>:children;
}
