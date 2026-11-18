import Link from 'next/link';
import{platformSchoolAdminHref}from'@/lib/platformAdminNavigation';
import{accountSchools,accountSchoolState,type SchoolAccount}from'@/lib/adminAccountSchools';
export default function AccountSchoolDetails({account}:{account:SchoolAccount}){
 const schools=accountSchools(account);
 if(!schools.length)return <span className="text-sm text-muted-foreground">{account.school_id?'School information unavailable':'No school affiliation'}</span>;
 return <ul className="space-y-2" aria-label="School affiliations">{schools.map(school=><li key={school.school_id} className="min-w-0"><Link href={platformSchoolAdminHref(school.school_id,'members')} className="inline-flex min-h-11 max-w-full items-center rounded-md py-2 whitespace-normal break-words text-sm font-semibold leading-5 text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{school.school_name}</Link><p className="mt-0.5 whitespace-normal break-words text-sm leading-5 text-muted-foreground">{school.membership_type==='STUDENT'?'Student':school.membership_type==='TEACHER'?'Teacher':school.membership_type==='EXTERNAL'?'External collaborator':null}{school.membership_type?' · ':null}{accountSchoolState(school)}{school.student_number?<> · Student ID: {school.student_number}</>:null}</p></li>)}</ul>;
}
