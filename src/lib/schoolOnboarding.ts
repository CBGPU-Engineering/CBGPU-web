/** Draft answers stay in component memory and the authenticated draft API, never URLs/localStorage. */
export const SCHOOL_FEATURES=[{id:'community',label:'학교 커뮤니티',description:'학교 구성원의 소식과 이야기를 나눠요.'},{id:'school_life',label:'학교생활',description:'학교에서 설정한 시간표와 생활 기능을 사용해요.'},{id:'projects',label:'프로젝트',description:'개인과 팀의 프로젝트를 함께 관리해요.'},{id:'contests',label:'대회·행사',description:'대회를 열고 참가 신청과 제출물을 관리해요.'},{id:'gpu_compute',label:'GPU 컴퓨팅',description:'학교 서버가 있을 때 연결할 수 있어요.'},{id:'ai',label:'AI',description:'승인된 연산 정책과 이용 한도 안에서 사용해요.'}] as const;
export type SchoolFeature=typeof SCHOOL_FEATURES[number]['id'];
export type SchoolDraftData={school:{official_name:string;type:string;official_id:string;region:string;address:string;contact_email:string;contact_phone:string};administrator:{name:string;role:string;relationship:string;contact_email:string;verification_note:string};configuration:{display_name:string;brand_color:string;ads_enabled?:boolean;join_policy:'APPROVAL_REQUIRED';student_id_policy:'SCHOOL_DEFINED'|'CBSH_4_DIGIT';teacher_policy:'MANUAL_REVIEW';community_policy:'MEMBERS_ONLY'};features:SchoolFeature[];gpu:{choice:'CONNECT_LATER'|'NONE'|'CONNECT_NOW'};confirmed:boolean};
export const SCHOOL_STEPS=['school','administrator','configuration','features','gpu','review'] as const;
export type SchoolStep=typeof SCHOOL_STEPS[number];
export const SCHOOL_STEP_TITLES:Record<SchoolStep,string>={school:'우리 학교를 알려주세요',administrator:'어떤 분이 운영하나요?',configuration:'학교에 맞게 설정해요',features:'필요한 기능을 골라주세요',gpu:'GPU 서버는 나중에 연결해도 돼요',review:'신청 내용을 확인해주세요'};
export function emptySchoolDraft():SchoolDraftData{return{school:{official_name:'',type:'HIGH_SCHOOL',official_id:'',region:'',address:'',contact_email:'',contact_phone:''},administrator:{name:'',role:'STUDENT_OPERATOR',relationship:'',contact_email:'',verification_note:''},configuration:{display_name:'',brand_color:'#3182f6',join_policy:'APPROVAL_REQUIRED',student_id_policy:'SCHOOL_DEFINED',teacher_policy:'MANUAL_REVIEW',community_policy:'MEMBERS_ONLY'},features:['community','projects','contests'],gpu:{choice:'CONNECT_LATER'},confirmed:false}}
export function schoolStepError(step:SchoolStep,data:SchoolDraftData):string{
 const email=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
 if(step==='school'){if(!data.school.official_name.trim())return'학교의 정식 이름을 입력해주세요.';if(!data.school.region.trim())return'학교의 지역을 입력해주세요.';if(!email(data.school.contact_email))return'학교 연락 이메일을 확인해주세요.';}
 if(step==='administrator'){if(!data.administrator.name.trim())return'신청자 이름을 입력해주세요.';if(!data.administrator.relationship.trim())return'학교와의 관계와 운영 역할을 알려주세요.';if(!email(data.administrator.contact_email))return'신청자 연락 이메일을 확인해주세요.';if(!data.administrator.verification_note.trim())return'운영 관계를 확인할 수 있는 내용을 입력해주세요.';}
 if(step==='configuration'){if(!data.configuration.display_name.trim())return'학교에서 사용할 표시 이름을 입력해주세요.';if(!/^#[0-9a-f]{6}$/i.test(data.configuration.brand_color))return'기본 색상을 확인해주세요.';}
 if(step==='review'&&!data.confirmed)return'승인 전에는 관리자 권한이 부여되지 않는다는 내용을 확인해주세요.';
 return'';
}
