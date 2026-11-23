const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Only the two reviewed school-scoped routes may exceed the existing path bound. */
export function extendedSchoolClubPath(parts:readonly string[],method:string){
 if(parts[0]!=='schools'||!/^[-A-Za-z0-9_]{1,100}$/.test(parts[1]||'')||parts[2]!=='clubs'||!uuid.test(parts[3]||'')||parts[4]!=='applications'||!uuid.test(parts[5]||''))return false;
 return parts.length===6&&method==='PATCH'||parts.length===7&&parts[6]==='withdraw'&&method==='POST';
}
