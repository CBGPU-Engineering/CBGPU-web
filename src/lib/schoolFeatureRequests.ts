export const featureRequestStatuses=['PENDING','REVIEWING','ACCEPTED','REJECTED','DELIVERED'] as const;
export type FeatureRequestStatus=typeof featureRequestStatuses[number];
export type SchoolFeatureRequest={id:string;school_id:string;school_display_name?:string;requester_id:string;feature_key:string;title:string;description:string;status:FeatureRequestStatus;revision:number;operator_message:string|null;created_at:string;updated_at:string;notification_status:string|null};
export function notificationMeaning(status:string|null|undefined){return status==='SENT'?'Accepted by the email provider; inbox delivery is not confirmed.':status==='FAILED'?'Email notification failed; the saved request remains available.':status==='PENDING'?'Email notification queued.':'Email notification status unavailable.'}
export function featureRequestStatusLabel(status:string){return({PENDING:'접수 완료',REVIEWING:'검토 중',ACCEPTED:'진행 예정',REJECTED:'반려',DELIVERED:'제공 완료'}as Record<string,string>)[status]||status}

export function featureReviewDecisions(status:FeatureRequestStatus):Exclude<FeatureRequestStatus,'PENDING'>[]{return status==='PENDING'?['REVIEWING','ACCEPTED','REJECTED']:status==='REVIEWING'?['ACCEPTED','REJECTED']:status==='ACCEPTED'?['DELIVERED','REJECTED']:[]}

export function featureOperatorError(error:unknown,fallback:string){return error instanceof Error&&/^[\x20-\x7e]{1,500}$/.test(error.message)?error.message:fallback}
