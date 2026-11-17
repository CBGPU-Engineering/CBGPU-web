'use client';
import {supabase} from './supabase';
export type OrganizerInvitation={id:string;contest_id:string;contest_title:string;school_id:string;school_name:string;status:'INVITED'|'ACCEPTED'|'DECLINED'|'REVOKED';revision:number;created_at:string;updated_at:string};
export type OrganizerAudit={action:string;previous_status:string|null;status:string;revision:number;created_at:string};
export class OrganizerError extends Error{constructor(readonly code:string,message:string){super(message)}}
const errors:Record<string,string>={OPERATOR_REVISION_CONFLICT:'운영자 요청이 변경됐어요. 새로고침한 뒤 다시 확인해주세요.',EXISTING_OPERATOR_REVIEW_SEPARATELY:'이미 별도로 지정한 운영자예요. 기존 공동 운영자에서 권한을 관리해주세요.',NOMINEE_AUTHORITY_EXPIRED:'추천자의 학교 관리자 권한이나 동의 당시 로그인이 만료됐어요. 새로 추천받아주세요.',ORGANIZER_REVISION_CONFLICT:'다른 담당자가 먼저 변경했어요. 새로고침한 뒤 내용을 확인해주세요.',CONTEST_OWNER_REQUIRED:'대회를 만든 계정만 공동 주최 학교를 초대할 수 있어요.',TARGET_SCHOOL_ADMIN_REQUIRED:'초대받은 학교의 인증된 관리자만 수락할 수 있어요.',APPROVED_CONTEST_SCHOOL_REQUIRED:'대회 기능을 사용하는 승인된 학교만 연결할 수 있어요.',FRESH_IDENTITY_REQUIRED:'현재 로그인 상태를 다시 확인해주세요.',ORGANIZER_ALREADY_INVITED:'이미 초대했거나 공동 주최를 수락한 학교예요.'};
export type OperatorNomination={id:string;invitation_id:string;contest_id:string;school_id:string;school_name:string;display_name:string|null;status:'PENDING'|'APPROVED'|'REJECTED'|'WITHDRAWN'|'REVOKED';revision:number;owned_grant_active:boolean;event_role:'manager'|'checkin'|null;updated_at:string};
export function contestOrganizerRequest<T>(owner:string,action:string,payload:Record<string,unknown>):Promise<T>{return request<T>(owner,'cbgpu_contest_organizer_schools',action,payload)}
export function contestOperatorRequest<T>(owner:string,action:string,payload:Record<string,unknown>):Promise<T>{return request<T>(owner,'cbgpu_contest_school_operators',action,payload)}
async function request<T>(owner:string,rpc:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const session=(await supabase.auth.getSession()).data.session;if(!session||session.user.id!==owner)throw Error('계정이 바뀌었어요. 현재 계정에서 다시 시도해주세요.');
 // Freeze the initiating identity even if another account signs in while the request is pending.
 const {data,error}=await supabase.rpc(rpc,{p_action:action,p_payload:payload}).setHeader('Authorization','Bearer '+session.access_token);
 if((await supabase.auth.getSession()).data.session?.user.id!==owner)throw Error('계정이 바뀌었어요. 현재 계정에서 다시 시도해주세요.');
 if(error)throw new OrganizerError(error.message,errors[error.message]||'공동 주최 학교 정보를 처리하지 못했어요. 학교 소속과 현재 권한을 확인해주세요.');return data as T;
}
