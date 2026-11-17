/** Accept only the server-selected, currently verified membership. Never infer another school. */
export function selectedSchoolContext(value: unknown): {id:string;studentNumber:string|null}|null {
 if(!value||typeof value!=='object')return null;
 const dto=value as {current_school_id?:unknown;items?:unknown};
 if(typeof dto.current_school_id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(dto.current_school_id)||!Array.isArray(dto.items))return null;
 const matches=dto.items.filter(item=>item&&typeof item==='object'&&item.school_id===dto.current_school_id);
 if(matches.length!==1)return null;
 const item=matches[0];
 if(item.status!=='ACTIVE'||item.verified!==true||item.school?.id!==dto.current_school_id||item.school?.status!=='APPROVED')return null;
 return {id:dto.current_school_id,studentNumber:typeof item.student_number==='string'?item.student_number:null};
}
export function scopedSchoolPath(path:string,schoolId:string|null):string {
 if(!schoolId)return path;
 const separator=path.includes('?')?'&':'?';
 return path+separator+'school_id='+encodeURIComponent(schoolId);
}
