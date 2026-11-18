import{schoolAdminSections,schoolAdminHref}from'./schoolAdministration.ts';
/** A management scope comes from the route, never the account's preferred school. */
export function platformAdminSchool(path:string,section:string|null){
 const scoped=path.match(/^\/schools\/([-A-Za-z0-9_]{1,100})\/admin$/),inspection=path.match(/^\/admin\/schools\/([-A-Za-z0-9_]{1,100})(?:\/(life-sources|central-cpu|manage))?$/);
 const match=scoped||inspection;if(!match)return null;
 const selected=(scoped||inspection?.[2]==='manage')&&schoolAdminSections.some(item=>item.id===section)?section!:'overview';
 return{schoolId:match[1],section:selected};
}

export function platformSchoolAdminHref(school:string,section='overview') {
 const scoped=schoolAdminHref(school,section);
 return '/admin/schools/'+encodeURIComponent(school)+'/manage'+scoped.slice(scoped.indexOf('?'));
}
