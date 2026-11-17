'use client';
import type{ReactNode}from'react';
import{useAuth}from'@/lib/useAuth';
import MessageCenter from'@/components/schools/MessageCenter';
/** Only the public curated server children render before authentication settles.
 * Member reads are owned by MessageCenter's fresh, scoped APIs; no private SSR DTO is sent. */
export default function CommunityEntry({children}:{children:ReactNode}){
 const{user,isLoading}=useAuth();
 return process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'&&!isLoading&&user?<MessageCenter/>:children;
}
