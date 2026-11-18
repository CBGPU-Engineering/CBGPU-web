import{accountSchools,accountSchoolState,type SchoolAccount}from'@/lib/adminAccountSchools';
export default function AccountSchoolDetails({account}:{account:SchoolAccount}){
 const schools=accountSchools(account);
 if(!schools.length)return <span className="text-sm text-muted-foreground">{account.school_id?'School information unavailable':'No school affiliation'}</span>;
 return <ul className="space-y-2" aria-label="School affiliations">{schools.map(school=><li key={school.school_id} className="min-w-0"><p className="whitespace-normal break-words text-sm font-semibold leading-5">{school.school_name}</p><p className="mt-0.5 whitespace-normal break-words text-xs leading-5 text-muted-foreground">{school.membership_type==='STUDENT'?'Student':school.membership_type==='TEACHER'?'Teacher':school.membership_type==='EXTERNAL'?'External collaborator':null}{school.membership_type?' · ':null}{accountSchoolState(school)}{school.student_number?<> · Student ID: {school.student_number}</>:null}</p></li>)}</ul>;
}
