export const SCHOOL_GUEST_RESOURCES = [
  {id:'gpu',label:'GPU'}, {id:'study',label:'Study applications'},
  {id:'school_storage',label:'School storage'}, {id:'fabrication',label:'Fabrication'},
  {id:'school_compute',label:'Server / frontend compute'}, {id:'contests',label:'Contests'},
] as const;
export type SchoolGuestResource = typeof SCHOOL_GUEST_RESOURCES[number]['id'];
export type SchoolGuestRequest = {
  id:string;school_id:string;external_user_id:string;requester_id:string;
  project_name:string;purpose:string;resources:SchoolGuestResource[];
  starts_at:string;ends_at:string;created_at:string;reviewed_by?:string|null;reviewed_at?:string|null;
  status:'PENDING'|'APPROVED'|'REJECTED'|'REVOKED'|'EXPIRED';
};
export type GuestDecision='APPROVE'|'REJECT'|'REVOKE';
export type GuestDraft={external_email:string;project_name:string;purpose:string;resources:SchoolGuestResource[];starts_at:string;ends_at:string};
export function guestDraftPayload(draft:GuestDraft,now=Date.now()){
 const start=Date.parse(draft.starts_at),end=Date.parse(draft.ends_at);
 if(!draft.external_email.trim()||draft.external_email.length>320||!/^\S+@\S+\.\S+$/.test(draft.external_email.trim()))throw Error('Enter the collaborator’s verified CBGPU account email.');
 if(!draft.project_name.trim()||draft.project_name.trim().length>200)throw Error('Enter a project or event name (up to 200 characters).');
 if(!draft.purpose.trim()||draft.purpose.trim().length>4000)throw Error('Describe the purpose (up to 4,000 characters).');
 const resources=[...new Set(draft.resources)];
 if(!resources.length||resources.some(id=>!SCHOOL_GUEST_RESOURCES.some(item=>item.id===id)))throw Error('Choose the exact resources needed.');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<=now)throw Error('Choose a valid period ending after the start and the current time.');
 return{external_email:draft.external_email.trim(),project_name:draft.project_name.trim(),purpose:draft.purpose.trim(),resources,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()};
}
export function guestAccessPhase(request:SchoolGuestRequest,now=Date.now()){
 if(request.status!=='APPROVED')return request.status;
 if(Date.parse(request.ends_at)<=now)return 'EXPIRED';
 return Date.parse(request.starts_at)>now?'SCHEDULED':'ACTIVE';
}
export function guestReviewAllowed(request:SchoolGuestRequest,actor:string,decision:GuestDecision,now=Date.now()){
 if(!actor||request.requester_id===actor||request.external_user_id===actor)return false;
 if(decision==='REVOKE')return request.status==='APPROVED'&&Date.parse(request.ends_at)>now;
 return request.status==='PENDING'&&Date.parse(request.ends_at)>now;
}
export function guestRequestsForSchool(items:SchoolGuestRequest[],schoolId:string){return items.filter(item=>item.school_id===schoolId);}
