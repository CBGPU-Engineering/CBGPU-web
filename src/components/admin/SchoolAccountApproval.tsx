'use client';
import Link from 'next/link';
import{useRef,useState}from'react';
import{Button}from'@/components/ui/button';
import{useAuth}from'@/lib/useAuth';
import{useAppFrame}from'@/lib/useAppFrame';
import{useAlert}from'@/lib/alert';
import{schoolsRequest}from'@/lib/schoolsClient';
import{platformSchoolAdminHref}from'@/lib/platformAdminNavigation';
import{schoolAccountApprovalScope,type SchoolAccount,type AccountSchool}from'@/lib/adminAccountSchools';
export async function approveSchoolAccountMembership(school:AccountSchool,targetUserId:string,actorId:string,request=schoolsRequest){
 if(actorId===targetUserId||school.school_id==='cbsh'||school.status!=='PENDING_VERIFICATION'||!school.membership_id||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(school.membership_id))throw Error('School membership needs independent review.');
 const value=await request<{membership?:{id?:string;user_id?:string;school_id?:string;status?:string;verified?:boolean}}>('schools/'+encodeURIComponent(school.school_id)+'/members/'+school.membership_id,'PATCH',{action:'APPROVE',verification_note:'School membership reviewed through Accounts.'},false,actorId);
 const member=value.membership;if(!member||member.id!==school.membership_id||member.user_id!==targetUserId||member.school_id!==school.school_id||member.status!=='ACTIVE'||member.verified!==true)throw Error('Approval result could not be confirmed. Refresh Accounts before retrying.');
 return member;
}
export default function SchoolAccountApproval({account,schoolFilter='all',onUpdated}:{account:SchoolAccount&{id:string;full_name?:string|null};schoolFilter?:string;onUpdated:()=>void|Promise<void>}){
 const{user}=useAuth(),app=useAppFrame(false),{confirm,showError,showSuccess}=useAlert(),[busy,setBusy]=useState(false),gate=useRef(false),current=useRef('');
 const scope=schoolAccountApprovalScope(account,schoolFilter);current.current=account.id+':'+schoolFilter+':'+(user?.id||'');const t=(en:string,ko:string)=>app?ko:en;
 if(scope.kind==='legacy')return null;
 if(scope.kind==='select-school')return <span className="text-sm text-muted-foreground">{t('Select a school to review','학교를 선택해 주세요')}</span>;
 if(scope.kind!=='school'||!scope.school)return <span className="text-sm text-muted-foreground">{t('School review unavailable','학교 소속 확인 필요')}</span>;
 const school=scope.school,self=user?.id===account.id;
 async function approve(){if(!user||self||gate.current||!school||account.account_status==='SUSPENDED')return;const context=current.current;gate.current=true;setBusy(true);let saved=false;try{
  if(!await confirm({title:t('Approve school membership?','학교 소속을 승인할까요?'),message:`${account.full_name||''} · ${school.school_name}${school.student_number?' · '+school.student_number:''}\n`+t('Independently verify this affiliation. Only this school membership changes.','실제 학교 소속을 확인해 주세요. 이 학교 소속만 승인돼요.'),confirmLabel:t('Approve membership','학교 소속 승인'),cancelLabel:t('Cancel','취소')}))return;
  if(current.current!==context)return;
  await approveSchoolAccountMembership(school,account.id,user.id);saved=true;await onUpdated();
  if(current.current===context)showSuccess(t('School membership approved.','학교 소속을 승인했어요.'));
 }catch(error){if(current.current===context)showError(saved?t('Membership approved. Refresh Accounts to see its current state.','승인됐어요. 계정 목록을 새로고침해 주세요.'):t('Approval could not be confirmed. Refresh and check your school permissions.','승인 결과를 확인하지 못했어요. 새로고침 후 권한을 확인해 주세요.'))}finally{gate.current=false;setBusy(false)}}
 return <div className="flex min-w-0 flex-wrap items-center gap-2" data-school-account-approval={school.school_id} data-school-account-user={account.id}>
 {school.status==='PENDING_VERIFICATION'&&account.account_status!=='SUSPENDED'&&school.membership_id&&<Button type="button" variant="outline" className="min-h-11" disabled={busy||self||!user} onClick={()=>void approve()}>{t('Approve membership','학교 소속 승인')}</Button>}
 <Button asChild variant="ghost" className="min-h-11"><Link href={platformSchoolAdminHref(school.school_id,'members')}>{t('School members','학교 구성원')}</Link></Button>
 {self&&school.status==='PENDING_VERIFICATION'&&<span className="text-sm text-muted-foreground">{t('Independent reviewer required','다른 관리자의 확인 필요')}</span>}
 </div>;
}
