export type AccountSchool={membership_id?:string;school_id:string;school_name:string;status:string;membership_type:string;student_number:string|null;verified:boolean};
export type SchoolAccount={account_status?:string;is_approved?:boolean|null;school_id?:string|null;primary_school_name?:string|null;school_affiliations?:AccountSchool[]};
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

export type SchoolAccountApprovalScope={kind:'legacy'|'select-school'|'unavailable'|'school';school?:AccountSchool};
export function schoolAccountApprovalScope(account:SchoolAccount,schoolFilter='all'):SchoolAccountApprovalScope{
 if(!Array.isArray(account.school_affiliations)&&schoolFilter!=='all'&&schoolFilter!=='cbsh')return{kind:'unavailable'};
 if(!Array.isArray(account.school_affiliations))return !account.school_id||account.school_id==='cbsh'?{kind:'legacy'}:{kind:'unavailable'};
 const schools=account.school_affiliations.filter(school=>!!school.school_id&&school.status!=='PRIMARY');
 if(schoolFilter==='all'&&schools.length>1)return{kind:'select-school'};
 const school=schoolFilter==='all'?schools[0]:schools.find(school=>school.school_id===schoolFilter);
 if(!school)return{kind:'unavailable'};
 return school.school_id==='cbsh'?{kind:'legacy',school}:{kind:'school',school};
}
export function schoolAccountApprovalState(account:SchoolAccount,schoolFilter='all'):'approved'|'unreviewed'|'restricted'|'multiple'|'unavailable'{
 if(account.account_status==='SUSPENDED')return'restricted';const scope=schoolAccountApprovalScope(account,schoolFilter);if(scope.kind==='legacy')return account.is_approved===true?'approved':account.is_approved===false?'restricted':'unreviewed';
 if(scope.kind==='select-school')return'multiple';if(scope.kind==='unavailable'||!scope.school)return'unavailable';
 return scope.school.status==='SUSPENDED'?'restricted':scope.school.status==='ACTIVE'&&scope.school.verified?'approved':'unreviewed';
}
