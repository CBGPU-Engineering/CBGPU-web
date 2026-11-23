export const contestParticipantPolicies=['ALL_ELIGIBLE','HIGH_SCHOOL_STUDENTS','MIDDLE_SCHOOL_STUDENTS','SECONDARY_SCHOOL_STUDENTS','SCHOOL_TEACHERS'] as const;
export type ContestParticipantPolicy=typeof contestParticipantPolicies[number];
export const contestParticipantPolicyLabels:Record<ContestParticipantPolicy,string>={ALL_ELIGIBLE:'참가 범위에서 이용 권한이 있는 계정',HIGH_SCHOOL_STUDENTS:'소속 확인을 마친 고등학생',MIDDLE_SCHOOL_STUDENTS:'소속 확인을 마친 중학생',SECONDARY_SCHOOL_STUDENTS:'소속 확인을 마친 중·고등학생',SCHOOL_TEACHERS:'소속 확인을 마친 학교 교사'};
export type ContestSchoolPolicy = {
  school_id: string;
  access_scope: 'SCHOOL' | 'MULTI_SCHOOL' | 'PUBLIC';
  allowed_school_ids: string[];
  participant_policy: ContestParticipantPolicy;
};
export function contestSchoolPolicyError(value: ContestSchoolPolicy, verifiedSchoolId: string | null): string | null {
  if (!verifiedSchoolId || value.school_id !== verifiedSchoolId) return '인증된 운영 학교를 먼저 선택해 주세요.';
  if (!['SCHOOL', 'MULTI_SCHOOL', 'PUBLIC'].includes(value.access_scope)) return '참가 범위를 선택해 주세요.';
  if (!contestParticipantPolicies.includes(value.participant_policy)) return '참가 자격을 확인해 주세요.';
  if (value.allowed_school_ids.length > 100 || new Set(value.allowed_school_ids).size !== value.allowed_school_ids.length || value.allowed_school_ids.some(id => !/^[-A-Za-z0-9_]{1,100}$/.test(id) || id === value.school_id)) return '참가 학교 목록을 다시 확인해 주세요.';
  if (value.access_scope === 'MULTI_SCHOOL' ? !value.allowed_school_ids.length : !!value.allowed_school_ids.length) return '참가 범위에 맞게 참가 학교 목록을 다시 확인해 주세요.';
  return null;
}
