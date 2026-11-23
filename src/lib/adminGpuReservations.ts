/** Presentation only. Database RLS and approval RPC remain the authorization boundary. */
export type AdminGpuReservation = {id:string;status:string;gpu_id:number;start_time:string;end_time:string;purpose?:string|null;user_email?:string|null;profiles?:{full_name?:string|null;student_id?:string|null}|null};
export const adminGpuViews = ['all','pending','approved','active','upcoming','ended','rejected'] as const;
export type AdminGpuView = typeof adminGpuViews[number];
export function matchesAdminGpuView(row:AdminGpuReservation,view:string,now:number):boolean {
 const start=Date.parse(row.start_time),end=Date.parse(row.end_time);
 switch(view){
 case 'all':return true;
 case 'pending':return row.status==='pending'&&end>now;
 case 'approved':return row.status==='approved';
 case 'active':return row.status==='approved'&&start<=now&&end>now;
 case 'upcoming':return row.status==='approved'&&start>now&&end>now;
 case 'ended':return Number.isFinite(end)&&end<=now;
 case 'rejected':return row.status==='rejected';
 default:return row.status===view;
 }
}
export function filterAdminGpuReservations<T extends AdminGpuReservation>(rows:T[],{view='all',gpu='all',query='',now=Date.now()}:{view?:string;gpu?:string;query?:string;now?:number}={}):T[]{
 const gpuTerm=query.match(/\bgpu\s*#?\s*(\d+)\b/i);
 const terms=query.replace(/\bgpu\s*#?\s*\d+\b/ig,' ').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return rows.filter(row=>matchesAdminGpuView(row,view,now)&&(!gpuTerm||String(row.gpu_id)===gpuTerm[1])&&(gpu==='all'||String(row.gpu_id)===gpu)&&terms.every(term=>[row.profiles?.full_name,row.profiles?.student_id,row.user_email,row.purpose,row.id,'GPU '+row.gpu_id].some(value=>String(value??'').toLocaleLowerCase().includes(term))));
}
/** Stable newest-first cursor: concurrent inserts/deletes must not shift older history pages. */
export function adminGpuHistoryBefore(row:{id:string;created_at?:string|null}):string{
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.id))throw Error('Invalid reservation cursor');
 if(row.created_at==null)return 'and(created_at.is.null,id.lt.'+row.id+')';
 if(!/^[0-9TtZz:+.\- ]{10,40}$/.test(row.created_at)||!Number.isFinite(Date.parse(row.created_at)))throw Error('Invalid reservation timestamp');
 return 'created_at.lt.'+row.created_at+',and(created_at.eq.'+row.created_at+',id.lt.'+row.id+'),created_at.is.null';
}
