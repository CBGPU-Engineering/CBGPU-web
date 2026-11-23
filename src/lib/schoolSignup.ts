import {isValidStudentId}from './studentId.ts';
export type SchoolSignupKind='STUDENT'|'TEACHER'|'EXTERNAL';
export type SchoolSignupChoice={path:'existing'|'new';school_id:string;kind:SchoolSignupKind;student_number:string;department:string};
export function schoolSignupValidation(choice:SchoolSignupChoice){if(choice.path==='new')return'';if(!choice.school_id&&choice.kind==='EXTERNAL')return'';if(!choice.school_id)return'소속을 요청할 학교를 선택해 주세요.';if(choice.kind==='STUDENT'){if(choice.school_id==='cbsh'&&!isValidStudentId(choice.student_number))return'충북과학고 학번 4자리를 확인해 주세요.';if(!choice.student_number.trim())return'학교 학생 번호를 입력해 주세요.';if(choice.student_number.trim().length>80)return'학교 학생 번호는 80자 이내로 입력해 주세요.';}return''}
/** Metadata records an untrusted request only; the backend verifies every affiliation and role. */
export function schoolSignupMetadata(name:string,choice:SchoolSignupChoice):Record<string,unknown>{
 if(choice.path==='existing'&&choice.school_id==='cbsh'&&choice.kind==='STUDENT')return{full_name:name.trim(),student_id:choice.student_number};
 return{full_name:name.trim(),account_type_request:'EXTERNAL',...(choice.path==='new'?{school_setup_request:true}:!choice.school_id&&choice.kind==='EXTERNAL'?{}:{school_join_request:{school_id:choice.school_id,type:choice.kind,...(choice.kind==='STUDENT'?{student_number:choice.student_number.trim()}:{}),...(choice.kind==='TEACHER'&&choice.department.trim()?{department:choice.department.trim()}:{})}})};
}
