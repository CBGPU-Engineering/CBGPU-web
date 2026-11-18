export const contestManagementSections=[
 {id:'overview',label:'운영 현황',description:'참가 현황과 대회 상태를 한눈에 확인해요.'},
 {id:'guests',label:'참가자',description:'신청 승인, 대기 명단과 현장 체크인을 관리해요.'},
 {id:'teams',label:'팀',description:'팀 구성과 팀별 참가 상태를 확인해요.'},
 {id:'submissions',label:'제출물',description:'작품 제출 기간과 받은 제출물을 관리해요.'},
 {id:'awards',label:'심사·투표',description:'투표 부문, 집계와 결과 공개를 관리해요.'},
 {id:'schedule',label:'세부 일정',description:'참가자에게 보여줄 행사 일정을 구성해요.'},
 {id:'updates',label:'공지',description:'사이트 공지와 참가자 이메일을 작성해요.'},
 {id:'presentation',label:'소개·배너',description:'참가자에게 보이는 대회 소개와 이미지를 수정해요.'},
 {id:'settings',label:'신청·장소',description:'신청 기간, 정원과 행사 장소를 설정해요.'},
 {id:'operators',label:'운영진',description:'공동 운영 학교와 담당자 권한을 관리해요.'},
 {id:'lifecycle',label:'보관·복제',description:'기록을 보존하며 대회를 보관하거나 복제해요.'},
] as const;
export type ContestManagementSection=typeof contestManagementSections[number]['id'];
export type ContestEventSection=Exclude<ContestManagementSection,'submissions'|'awards'|'presentation'>;
export function contestWorkspaceSections(canManage:boolean,isOwner:boolean){return contestManagementSections.filter(section=>canManage?(section.id!=='lifecycle'||isOwner):section.id==='guests')}
export function contestEventSection(section:ContestManagementSection):section is ContestEventSection{return !['submissions','awards','presentation'].includes(section)}
export function contestParticipantHref(id:string){return '/contests/'+encodeURIComponent(id)}
export function contestManagementHref(id:string){return contestParticipantHref(id)+'/manage'}

/** Share the participant entry, even when copied from the separate organizer workspace. */
export function contestTeamInvitationUrl(id:string,joinCode:string,origin:string){const url=new URL(contestParticipantHref(id),origin);url.searchParams.set('team',joinCode);return url.toString()}
