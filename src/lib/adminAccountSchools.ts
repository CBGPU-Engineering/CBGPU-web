export type AccountSchool={school_id:string;school_name:string;status:string;membership_type:string;student_number:string|null;verified:boolean};
export type SchoolAccount={school_id?:string|null;primary_school_name?:string|null;school_affiliations?:AccountSchool[]};
export function accountSchools(account:SchoolAccount):AccountSchool[]{
 const schools=new Map<string,AccountSchool>();
 for(const entry of account.school_affiliations??[])if(entry.school_id&&entry.school_name)schools.set(entry.school_id,entry);
 if(account.school_id&&account.primary_school_name&&!schools.has(account.school_id))schools.set(account.school_id,{school_id:account.school_id,school_name:account.primary_school_name,status:'PRIMARY',membership_type:'',student_number:null,verified:false});
 return [...schools.values()].sort((a,b)=>a.school_name.localeCompare(b.school_name,'ko',{numeric:true}));
}
export function accountSchoolOptions(accounts:SchoolAccount[]){const result=new Map<string,string>();for(const account of accounts)for(const school of accountSchools(account))result.set(school.school_id,school.school_name);return [...result].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));}
export function accountMatchesSchool(account:SchoolAccount,schoolId:string){if(schoolId==='all')return true;const schools=accountSchools(account);return schoolId==='none'?schools.length===0&&!account.school_id:schoolId==='unavailable'?schools.length===0&&!!account.school_id:schools.some(school=>school.school_id===schoolId)}
export function accountSchoolSearch(account:SchoolAccount){return accountSchools(account).flatMap(school=>[school.school_name,school.student_number??'']);}
export function accountSchoolState(school:AccountSchool){if(school.status==='PRIMARY')return 'Primary affiliation';if(school.status==='PENDING_VERIFICATION')return 'Verification pending';if(school.status==='REVERIFICATION_REQUIRED')return 'Reverification required';if(school.status==='SUSPENDED')return 'Suspended membership';return school.verified?'Verified member':'Unverified member'}
/** Display only the student numbers belonging to the displayed school scope. */
export function accountStudentNumberDisplay(account:SchoolAccount&{student_id?:string|null},schoolFilter='all'):string{
 const affiliations=account.school_affiliations;
 if(Array.isArray(affiliations)){
  const numbers=affiliations.filter(school=>schoolFilter==='all'||school.school_id===schoolFilter).map(school=>school.student_number?.trim()).filter((number):number is string=>!!number);
  return [...new Set(numbers)].join(' · ')||'—';
 }
 // An old response without ANY school metadata may still carry its original student ID.
 // Explicit empty memberships or an unresolved school never borrow that legacy number.
 if(schoolFilter==='all'&&!account.school_id&&!account.primary_school_name&&!Object.hasOwn(account,'school_affiliations'))return account.student_id?.trim()||'—';
 return '—';
}
