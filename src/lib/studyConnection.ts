// Pure display logic for the study connection probe result (no I/O, safe to unit test).
export type StudyConnection = {
  state: 'ok' | 'warning' | 'critical' | 'unknown';
  label: string;
  detail: string;
  rooms: number | null;
  failedRooms: number | null;
  checkedAt: string | null;
  minutesAgo: number | null;
  connectionExpiresAt: string | null;
  hoursLeft: number | null;
};

const OVERDUE_MIN = 15;

/** status.json is written every 5 minutes by operations/study/check.mjs; we only derive a display state from it. */
export function deriveStudyConnection(raw: unknown, now = Date.now()): StudyConnection {
  const empty: StudyConnection = {state: 'unknown', label: '상태 정보 없음', detail: '점검 결과를 찾을 수 없어요.', rooms: null, failedRooms: null, checkedAt: null, minutesAgo: null, connectionExpiresAt: null, hoursLeft: null};
  if (!raw || typeof raw !== 'object') return empty;
  const s = raw as Record<string, unknown>;
  const checked = typeof s.checked_at === 'string' ? Date.parse(s.checked_at) : NaN;
  const expires = typeof s.connection_expires_at === 'string' ? Date.parse(s.connection_expires_at) : NaN;
  const minutesAgo = Number.isFinite(checked) ? Math.max(0, Math.round((now - checked) / 60000)) : null;
  const hoursLeft = Number.isFinite(expires) ? (expires - now) / 3600000 : null;
  const base: StudyConnection = {
    ...empty,
    rooms: typeof s.rooms === 'number' ? s.rooms : null,
    failedRooms: typeof s.failed_rooms === 'number' ? s.failed_rooms : null,
    checkedAt: Number.isFinite(checked) ? new Date(checked).toISOString() : null,
    minutesAgo,
    connectionExpiresAt: Number.isFinite(expires) ? new Date(expires).toISOString() : null,
    hoursLeft: hoursLeft === null ? null : Math.round(hoursLeft * 10) / 10,
  };
  if (!Number.isFinite(checked) || checked - now > 5 * 60000 || (minutesAgo !== null && minutesAgo > OVERDUE_MIN)) {
    return {...base, state: 'critical', label: '점검이 멈췄어요', detail: `마지막 점검이 ${minutesAgo ?? '?'}분 전이에요.`};
  }
  if (s.detail === 'shared_connection_missing') return {...base, state: 'critical', label: '토큰이 등록되지 않았어요', detail: '자습 설정에서 토큰을 등록해 주세요.'};
  if (s.detail === 'shared_connection_expired' || (hoursLeft !== null && hoursLeft <= 0)) return {...base, state: 'critical', label: '토큰이 만료됐어요', detail: '자습 조회가 실패해요. 새 토큰을 등록해 주세요.'};
  if (s.status === 'unavailable') return {...base, state: 'critical', label: '자습 조회가 실패하고 있어요', detail: '학교 자습 시스템 응답에 문제가 있어요.'};
  if (s.status === 'degraded' && (base.failedRooms || 0) > 0) return {...base, state: 'warning', label: '일부 자습실 조회 실패', detail: `${base.failedRooms}개 자습실 구성을 불러오지 못했어요.`};
  if (hoursLeft !== null && hoursLeft <= 24) return {...base, state: 'warning', label: '토큰이 곧 만료돼요', detail: `약 ${Math.max(1, Math.round(hoursLeft))}시간 뒤 만료돼요.`};
  return {...base, state: 'ok', label: '정상', detail: '자습 조회가 정상 동작해요.'};
}
