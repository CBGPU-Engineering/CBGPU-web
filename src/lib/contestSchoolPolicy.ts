export type ContestSchoolPolicy = {
  school_id: string;
  access_scope: 'SCHOOL' | 'MULTI_SCHOOL' | 'PUBLIC';
  allowed_school_ids: string[];
  participant_policy: 'ALL_ELIGIBLE' | 'HIGH_SCHOOL_STUDENTS';
};
export function contestSchoolPolicyError(value: ContestSchoolPolicy, verifiedSchoolId: string | null): string | null {
  if (!verifiedSchoolId || value.school_id !== verifiedSchoolId) return '인증된 운영 학교를 먼저 선택해 주세요.';
  if (!['SCHOOL', 'MULTI_SCHOOL', 'PUBLIC'].includes(value.access_scope)) return '참가 범위를 선택해 주세요.';
  if (!['ALL_ELIGIBLE', 'HIGH_SCHOOL_STUDENTS'].includes(value.participant_policy)) return '참가 자격을 확인해 주세요.';
  if (value.allowed_school_ids.length > 100 || new Set(value.allowed_school_ids).size !== value.allowed_school_ids.length || value.allowed_school_ids.some(id => !/^[-A-Za-z0-9_]{1,100}$/.test(id) || id === value.school_id)) return '참가 학교 목록을 다시 확인해 주세요.';
  if (value.access_scope === 'MULTI_SCHOOL' ? !value.allowed_school_ids.length : !!value.allowed_school_ids.length) return '연합 대회에 참가할 다른 학교를 선택해 주세요.';
  return null;
}
