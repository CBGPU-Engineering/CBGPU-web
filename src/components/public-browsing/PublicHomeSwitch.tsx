'use client';
import type{ReactNode}from'react';
import{useAuth}from'@/lib/useAuth';
import WorkspaceHome from'@/components/workspaces/WorkspaceHome';
/** The protected reader component mounts only after an actual authenticated client session exists. */
export default function PublicHomeSwitch({children,sessionHint=false}:{children:ReactNode;sessionHint?:boolean}){const{user,isLoading}=useAuth();if(user)return <WorkspaceHome/>;if(isLoading&&sessionHint)return <p role="status" className="cb-public-loading">내 작업 공간을 확인하고 있어요.</p>;return children}
