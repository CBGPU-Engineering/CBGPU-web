import {trustedInternalServiceUrl} from './internalServiceUrl';
import {boundedSchoolBody} from './schoolsProxySecurity';
export type AdminAccountAffiliation={school_id:string;school_name:string;status:string;membership_type:string;student_number:string|null;verified:boolean};
/** Only called after the global administrator guard; retain the caller's real JWT. */
export async function adminAccountAffiliations(authorization:string,options:{endpoint:string;networkMode?:string;fetcher?:typeof fetch;timeoutMs?:number}){
 const base=trustedInternalServiceUrl(options.endpoint,options.networkMode),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),options.timeoutMs??20000);
 const fetcher=options.fetcher??fetch;
 const read=async(path:string)=>{
  const url=new URL(base);url.pathname='/v1/'+path.split('?')[0];url.search=path.includes('?')?path.slice(path.indexOf('?')+1):'';
  const response=await fetcher(url,{headers:{Authorization:authorization,Accept:'application/json'},cache:'no-store',redirect:'error',signal:controller.signal});
  if(!response.ok||response.redirected)throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
  const value=JSON.parse(await boundedSchoolBody(response.body,2*1024*1024));
  if(!value||!Array.isArray(value.items))throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
  return value;
 };
 try{
  const schools=new Map<string,string>();
  for(const status of ['APPROVED','SUSPENDED'])for(let offset=0;;offset+=100){
   const page=await read('admin/schools?status='+status+'&limit=100&offset='+offset);
   if(!Number.isSafeInteger(page.total)||page.total<0||page.total>1000||page.items.length>100||offset>=1000)throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
   for(const school of page.items){if(typeof school.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(school.id)||typeof school.display_name!=='string'||!school.display_name.trim())throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');schools.set(school.id,school.display_name);}
   if(offset+page.items.length>=page.total)break;
   if(page.items.length!==100)throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
  }
  const result=new Map<string,AdminAccountAffiliation[]>(),entries=[...schools];let next=0;
  await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
   while(next<entries.length){const [schoolId,schoolName]=entries[next++];const page=await read('schools/'+encodeURIComponent(schoolId)+'/members');
    if(page.items.length>10000||!Number.isSafeInteger(page.total)||page.total!==page.items.length)throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
    for(const member of page.items){if(typeof member.user_id!=='string'||member.school_id!==schoolId||!['ACTIVE','PENDING_VERIFICATION','REVERIFICATION_REQUIRED','SUSPENDED'].includes(member.status)||!['STUDENT','TEACHER','EXTERNAL'].includes(member.membership_type)||typeof member.verified!=='boolean'||!(member.student_number==null||typeof member.student_number==='string'))throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
     const list=result.get(member.user_id)??[];if(list.some(x=>x.school_id===schoolId))throw Error('SCHOOL_AFFILIATIONS_UNAVAILABLE');
     list.push({school_id:schoolId,school_name:schoolName,status:member.status,membership_type:member.membership_type,student_number:member.student_number??null,verified:member.verified});result.set(member.user_id,list);
    }
   }
  }));
  for(const list of result.values())list.sort((a,b)=>a.school_name.localeCompare(b.school_name)||a.school_id.localeCompare(b.school_id));
  return {affiliations:result,schools};
 }finally{controller.abort();clearTimeout(timer)}
}
