/** School-scoped presentation only. API identifiers and global platform roles are unchanged. */
export const schoolRoleLabel=(value:string)=>(({STUDENT:'학생',TEACHER:'교사',EXTERNAL:'외부인',SCHOOL_OWNER:'학교 대표 관리자',SCHOOL_ADMIN:'학교 관리자',COMMUNITY_MODERATOR:'커뮤니티 담당자',GPU_ADMIN:'GPU 관리자'} as Record<string,string>)[value]||'권한 확인 필요');
export const schoolStatusLabel=(value:string)=>(({ACTIVE:'활성',PENDING:'승인 대기',PENDING_VERIFICATION:'소속 확인 대기',REVERIFICATION_REQUIRED:'학번 재인증 필요',SUSPENDED:'이용 정지',APPROVED:'승인됨',REJECTED:'거절됨',REVOKED:'회수됨',EXPIRED:'기간 만료',SCHEDULED:'시작 대기',WITHDRAWN:'요청 취소',INVITED:'초대 대기',ACCEPTED:'수락됨',DECLINED:'초대 거절',READY:'연결 준비됨',DISABLED:'사용 안 함',NOT_CONFIGURED:'미설정',LOOKUP_REQUIRED:'학교 조회 필요',ONLINE:'상태 보고 수신',OFFLINE:'상태 보고 없음',NOT_REQUESTED:'요청 전'} as Record<string,string>)[value]||'상태 확인 필요');
export const schoolActionLabel=(value:string)=>(({APPROVE:'승인',REJECT:'거절',SUSPEND:'이용 정지',RESTORE:'이용 복구',REVOKE:'권한 회수',SET_ROLES:'학교 권한 변경'} as Record<string,string>)[value]||'처리 방법 선택');
export const schoolResourceLabel=(value:string)=>(({gpu:'GPU',study:'자습 신청',school_storage:'학교 저장소',fabrication:'제작 장비',school_compute:'서버·웹 배포',contests:'대회',school_life:'학교생활',gpu_compute:'GPU 사용',ai:'AI',projects:'프로젝트',community:'커뮤니티',cbsh_eduset:'충북과고 자습 신청',cbsh_wakeup:'충북과고 기상송'} as Record<string,string>)[value]||'학교 기능');
const errors:Record<string,string>={
 SOURCE_VERSION_CONFLICT:'다른 관리자가 연결 설정을 변경했어요. 현재 입력은 유지되니 최신 설정과 비교한 뒤 다시 확인해 주세요.',
 ACADEMIC_PREVIEW_CHANGED:'미리보기 이후 소속 정보가 바뀌었어요. 새 미리보기를 확인한 뒤 다시 실행해 주세요.',
 INVALID_STUDENT_NUMBERS_REQUIRE_REVIEW:'확인이 필요한 학번을 먼저 수정한 뒤 새 미리보기를 요청해 주세요.',
 INVALID_ACADEMIC_YEAR:'올해 또는 다음 학년도를 선택해 주세요.',UNSUPPORTED_ACADEMIC_POLICY:'이 학교의 학번·학년 규칙은 아직 지원하지 않아 학년도 전환을 실행할 수 없어요.',
 DUPLICATE_STUDENT_NUMBER:'해당 학교·학년도에 이미 등록된 학번이에요. 다른 사람의 학번인지 확인해 주세요.',INVALID_STUDENT_NUMBER:'학교의 학번 형식과 대상 학년이 맞는지 확인해 주세요.',
 REVERIFICATION_NOT_REQUIRED:'현재 이 학교 소속은 학번 재인증 대상이 아니에요.',SCHOOL_ADMIN_REQUIRED:'이 학교의 관리자 권한을 확인한 뒤 다시 시도해 주세요.',
 EXPLICIT_CONFIRMATION_REQUIRED:'대상과 변경 내용을 확인한 뒤 동의해 주세요.',ORGANIZER_REVISION_CONFLICT:'초대 내용이 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.',
 'Enter the collaborator’s verified CBGPU account email.':'협업자가 이메일 인증을 마친 CBGPU 계정의 이메일을 입력해 주세요.',
 'Enter a project or event name (up to 200 characters).':'프로젝트 또는 행사 이름을 200자 이내로 입력해 주세요.',
 'Describe the purpose (up to 4,000 characters).':'이용 목적을 4,000자 이내로 입력해 주세요.',
 'Choose the exact resources needed.':'필요한 자원을 선택해 주세요.',
 'Choose a valid period ending after the start and the current time.':'종료 시각은 시작 시각과 현재 시각 이후로 선택해 주세요.',
 'Load this school’s current enabled sources and confirm the independent review first.':'현재 학교의 연결 설정을 불러오고 독립적인 검토에 동의해 주세요.',
 'Use 1–10 reviewed public DNS hostnames, without schemes, paths, wildcards or local names.':'검토한 공개 호스트 이름을 1~10개 입력해 주세요. 주소 형식·경로·와일드카드·내부 호스트는 사용할 수 없어요.',
 'Enter a valid HTTPS source URL.':'올바른 HTTPS 정보 출처 주소를 입력해 주세요.',
 'Every source must use HTTPS and an exact reviewed host, without credentials, fragments or custom ports.':'모든 주소는 검토된 호스트의 HTTPS여야 해요. 로그인 정보·주소 조각·사용자 지정 포트는 넣지 마세요.',
 'Verify the Comcigan code against this school’s canonical name and region.':'컴시간 학교 코드가 공식 학교명과 지역에 맞는지 확인해 주세요.'
};
export function schoolAdminError(error:unknown,fallback='요청 결과를 확인하지 못했어요. 새로고침한 뒤 다시 확인해 주세요.'){
 const message=error instanceof Error?error.message:typeof error==='string'?error:'';
 for(const[key,value]of Object.entries(errors))if(message.includes(key))return value;
 const status=typeof error==='object'&&error!==null&&'status'in error?(error as{status:unknown}).status:null;
 if(status===401||/AUTHENTICATION_REQUIRED|INVALID_SESSION|SESSION_EXPIRED/.test(message))return '로그인 상태를 확인한 뒤 다시 시도해 주세요.';
 if(/SELF_REVIEW|INDEPENDENT_REVIEW/.test(message))return '본인과 관련된 요청은 다른 학교 관리자가 검토해야 해요.';
 if(status===403||/FORBIDDEN|ADMIN_REQUIRED|PERMISSION_REQUIRED/.test(message))return '이 학교에서 이 작업을 처리할 권한을 확인해 주세요.';
 if(status===409||/REVISION_CONFLICT|23505/.test(message))return '다른 처리로 내용이 바뀌었거나 이미 실행된 작업이에요. 새로고침한 뒤 결과를 확인해 주세요.';
 return fallback;
}
