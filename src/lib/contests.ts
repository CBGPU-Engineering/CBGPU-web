import type {ContestParticipantPolicy} from './contestSchoolPolicy';
export type ContestFieldType = 'file' | 'link' | 'text';
export type ContestField = {
  id: string;
  type: ContestFieldType;
  label: string;
  description: string;
  required: boolean;
  extensions: string;
  max_size_mb: number;
};
export type Contest = {
  school_id?: string;
  access_scope?: 'PRIVATE'|'SCHOOL'|'MULTI_SCHOOL'|'AUTHENTICATED'|'PUBLIC';
  allowed_school_ids?: string[];
  participant_policy?: ContestParticipantPolicy;
  id: string;
  host_id: string;
  participation_mode?: 'individual' | 'team';
  team_min_size?: number;
  team_max_size?: number;
  allow_individual_entries?: boolean;
  title: string;
  description: string;
  ends_at: string | null;
  starts_at?: string | null;
  logo_path: string | null;
  banner_path?: string | null;
  is_open: boolean;
  fields: ContestField[];
  created_at: string;
  event_start_at: string | null;
  event_end_at: string | null;
  location_type: 'offline' | 'online' | 'hybrid';
  location_name: string;
  address: string;
  visibility: 'public' | 'unlisted';
  capacity: number | null;
  waitlist_enabled: boolean;
  approval_required: boolean;
  registration_open: boolean;
  registration_closes_at: string | null;
  registration_opens_at?: string | null;
  registration_questions: RegistrationQuestion[];
  lifecycle_status: 'published' | 'cancelled' | 'archived';
  cancellation_message: string;
  updated_at: string;
};

export type RegistrationQuestionType = 'text' | 'paragraph' | 'choice' | 'checkbox' | 'terms';
export type RegistrationQuestion = {
  id: string;
  type: RegistrationQuestionType;
  label: string;
  required: boolean;
  options: string[];
};
export type RegistrationAnswer = string | string[] | boolean;
export type EventRegistrationStatus = 'confirmed' | 'pending' | 'waitlisted' | 'declined' | 'cancelled';
export type EventRegistration = {
  id: string;
  contest_id: string;
  user_id: string;
  attendee_name: string;
  answers: Record<string, RegistrationAnswer>;
  status: EventRegistrationStatus;
  participation_kind?: 'individual'|'team';
  ticket_code: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
};
export type EventSession = { id: string; contest_id: string; title: string; description: string; starts_at: string; ends_at: string; location: string; order_num: number };
export type EventAnnouncement = { id: string; contest_id: string; author_id: string; title: string; content: string; audience: 'all' | 'confirmed' | 'pending' | 'waitlisted'; published_at: string };
export type EventAccessDetails = { contest_id: string; meeting_url: string | null; access_note: string; updated_at: string };
export type EventHost = { contest_id: string; user_id: string; role: 'manager' | 'checkin'; show_public: boolean; created_at: string };
export type SubmittedFile = { path: string; name: string; size: number };
export type ContestAnswers = Record<string, string | SubmittedFile>;
export type ContestSubmission = {
  team_id?: string|null;
  contest_id: string;
  user_id: string;
  participant_name: string;
  student_id: string;
  student_id_consent?: boolean;
  student_id_consented_at?: string|null;
  answers: ContestAnswers;
  submitted_at: string;
};

export const FIELD_LABELS: Record<ContestFieldType, string> = { file: '파일', link: '링크', text: '텍스트' };
export const CONTEST_BUCKET = 'contest-submissions';
export const MAX_FILE_MB = 50;
export const MAX_FIELDS = 30;
export const REGISTRATION_STATUS_LABELS: Record<EventRegistrationStatus, string> = {
  confirmed: '참가 확정', pending: '승인 대기', waitlisted: '대기 명단', declined: '승인 거절', cancelled: '신청 취소',
};
export function remainingTime(endsAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  if (!seconds) return '마감되었어요';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return `${days ? `${days}일 ` : ''}${hours}시간 ${minutes}분 ${seconds % 60}초 남음`;
}
export const contestClosed = (contest: Pick<Contest, 'is_open' | 'ends_at'>, now = Date.now()) =>
  !contest.is_open || (!!contest.ends_at && new Date(contest.ends_at).getTime() <= now);

export function formatContestDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }) + ' (한국 시간)' : '마감 제한 없음';
}

// datetime-local is deliberately interpreted in Korea time, regardless of the device timezone.
export function deadlineToISO(value: string) {
  return value ? new Date(`${value}+09:00`).toISOString() : null;
}

export function deadlineToInput(value: string | null) {
  if (!value) return '';
  return new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

export function eventError(error: unknown) {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  if (message?.includes('EVENT_REGISTRATION_CLOSED')) return '참가 신청이 마감됐어요.';
  if (message?.includes('EVENT_FULL')) return '참가 정원이 모두 찼어요.';
  return contestError(error);
}

const icsEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function downloadEventCalendar(contest: Contest) {
  const period=contestCalendarPeriod(contest);if(!period)return;
  const end=period.ends_at;
  const location = [contest.location_name, contest.address].filter(Boolean).join(', ');
  const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CBGPU//Campus Events//KO', 'BEGIN:VEVENT',
    `UID:${contest.id}@cbgpu`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(period.starts_at)}`,
    `DTEND:${icsDate(end)}`, `SUMMARY:${icsEscape(contest.title)}`, `DESCRIPTION:${icsEscape(contest.description || '')}`,
    `LOCATION:${icsEscape(location)}`, `URL:${icsEscape(window.location.href)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${contest.title.replace(/[^가-힣a-zA-Z0-9_-]/g, '_')}.ics`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !/\s/.test(value);
  } catch { return false; }
}

export function fileError(file: Pick<File, 'name' | 'size'>, field: ContestField) {
  if (!file.size) return '내용이 있는 파일을 선택해 주세요.';
  if (file.size > field.max_size_mb * 1024 * 1024) return `${field.label}: 파일은 ${field.max_size_mb}MB 이하여야 해요.`;
  const allowed = field.extensions.split(',').map(ext => ext.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.some(ext => file.name.toLowerCase().endsWith(ext))) {
    return `${field.label}: ${allowed.join(', ')} 형식의 파일을 선택해 주세요.`;
  }
  return null;
}

export function validateAnswers(fields: ContestField[], answers: ContestAnswers, files: Record<string, File> = {}) {
  for (const field of fields) {
    const answer = answers[field.id];
    const file = files[field.id];
    const present = field.type === 'file' ? !!file || (typeof answer === 'object' && !!answer.path) : typeof answer === 'string' && !!answer.trim();
    if (field.required && !present) return `${field.label} 항목을 제출해 주세요.`;
    if (field.type === 'file' && file) {
      const error = fileError(file, field);
      if (error) return error;
    }
    if (typeof answer === 'string' && answer.trim()) {
      if (field.type === 'link' && (!isHttpUrl(answer.trim()) || answer.length > 2000)) return `${field.label}: 올바른 http 또는 https 링크를 입력해 주세요.`;
      if (field.type === 'text' && answer.length > 10000) return `${field.label}: 10,000자 이내로 입력해 주세요.`;
    }
  }
  return null;
}

export function contestError(error: unknown) {
  const message=error instanceof Error?error.message:(error as {message?:string})?.message;
  const code=typeof error==='object'&&error!==null&&'code'in error?String((error as {code:unknown}).code):'';
  if(/schema cache|does not exist/i.test(message||''))return '대회 기능을 사용할 수 없어요. 운영진에게 문의해 주세요.';
  if(message?.includes('CONTEST_CLOSED'))return '제출이 마감됐어요. 대회 일정을 확인해 주세요.';
  if(/EVENT_REGISTRATION_NOT_STARTED|CONTEST_NOT_STARTED/.test(message||''))return '아직 접수 시작 전이에요. 대회 일정을 확인해 주세요.';
  if(/PARTICIPANT_POLICY|ELIGIB/i.test(message||''))return '참가 대상과 현재 학교 소속을 확인해 주세요.';
  if(/FRESH_IDENTITY|INVALID_SESSION|JWT|SESSION_EXPIRED/i.test(message||''))return '로그인 상태를 다시 확인해 주세요.';
  if(code==='42501'||/row-level security|permission denied|FORBIDDEN|HOST_REQUIRED|SCHOOL_SCOPE/i.test(message||''))return '이 대회를 이용하거나 관리할 권한을 확인해 주세요.';
  if(code==='23505'||/already exists|duplicate key/i.test(message||''))return '이미 저장된 내용이 있어요. 새로고침한 뒤 결과를 확인해 주세요.';
  if(!code&&message&&/[가-힣]/.test(message)&&!/PGRST|SQLSTATE|private_schema|constraint|column|relation/i.test(message))return message;
  return '요청 결과를 확인하지 못했어요. 새로고침한 뒤 처리 상태를 확인해 주세요.';
}

export type ContestTeam = { id:string;contest_id:string;name:string;captain_id:string|null;kind:'formed'|'random';join_code:string;formation_status:'forming'|'ready'|'needs_members';created_at:string };
export type ContestTeamMember = {contest_id:string;team_id:string;user_id:string;registration_id:string;attendee_name:string;registration_status:EventRegistrationStatus;joined_at:string};
export type ContestTeamSettings = {participation_mode:'individual'|'team';team_min_size:number;team_max_size:number;allow_individual_entries:boolean};
export function contestTeamSettings(contest:Partial<ContestTeamSettings>):ContestTeamSettings{return {participation_mode:contest.participation_mode||'individual',team_min_size:contest.team_min_size??2,team_max_size:contest.team_max_size??5,allow_individual_entries:contest.allow_individual_entries??false};}
export function contestTeamSettingsError(settings:ContestTeamSettings,deadline:string|null){if(settings.participation_mode!=='team')return null;if(!Number.isInteger(settings.team_min_size)||!Number.isInteger(settings.team_max_size)||settings.team_min_size<1||settings.team_max_size>50||settings.team_min_size>settings.team_max_size)return '팀 인원은 1~50명으로 정하고, 최대 인원을 최소 인원 이상으로 입력해 주세요.';if(!deadline)return '팀 대회는 참가 신청 마감 또는 행사 시작 시간을 지정해 주세요.';return null;}
export function contestTeamJoinCode(value:string){const raw=value.trim();try{const fromUrl=new URL(raw).searchParams.get('team');if(fromUrl)return /^[a-f0-9-]{36}$/i.test(fromUrl)?fromUrl:null}catch{}return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)?raw:null;}

export type ContestPeriodPhase = 'checking'|'pending'|'open'|'closed';
export function contestSubmissionPhase(contest:Pick<Contest,'is_open'|'ends_at'>&{starts_at?:string|null},now:number|null):ContestPeriodPhase{if(!contest.is_open)return 'closed';if(now===null)return 'checking';if(contest.ends_at&&new Date(contest.ends_at).getTime()<=now)return 'closed';if(contest.starts_at&&new Date(contest.starts_at).getTime()>now)return 'pending';return 'open';}
export function contestRegistrationPhase(contest:Pick<Contest,'registration_open'|'registration_closes_at'|'event_start_at'>&{registration_opens_at?:string|null;lifecycle_status?:string;event_end_at?:string|null;ends_at?:string|null},now:number|null):ContestPeriodPhase{if(!contest.registration_open||(contest.lifecycle_status&&contest.lifecycle_status!=='published'))return 'closed';if(now===null)return 'checking';const dates=[contest.registration_closes_at||contest.event_start_at,contest.event_end_at||contest.ends_at].filter((value):value is string=>!!value);if(dates.some(value=>!Number.isFinite(Date.parse(value))))return 'closed';if(dates.some(value=>Date.parse(value)<=now))return 'closed';if(contest.registration_opens_at){const start=Date.parse(contest.registration_opens_at);if(!Number.isFinite(start))return 'closed';if(start>now)return 'pending';}return 'open';}

export type ContestEventPhase='checking'|'cancelled'|'archived'|'ended'|'upcoming'|'ongoing'|'unscheduled';
export function contestEventPhase(contest:{lifecycle_status?:string;event_start_at?:string|null;event_end_at?:string|null;ends_at?:string|null},now:number|null):ContestEventPhase{
 if(contest.lifecycle_status==='cancelled')return 'cancelled';if(contest.lifecycle_status==='archived')return 'archived';if(now===null)return 'checking';
 const end=contest.event_end_at||contest.ends_at;
 if(end&&Number.isFinite(Date.parse(end))&&Date.parse(end)<=now)return 'ended';
 if(contest.event_start_at&&Number.isFinite(Date.parse(contest.event_start_at)))return Date.parse(contest.event_start_at)>now?'upcoming':'ongoing';
 return 'unscheduled';
}
export function contestCalendarPeriod(contest:{event_start_at:string|null;event_end_at:string|null}):{starts_at:string;ends_at:string}|null{
 if(!contest.event_start_at)return null;const start=Date.parse(contest.event_start_at);if(!Number.isFinite(start))return null;
 const end=contest.event_end_at?Date.parse(contest.event_end_at):start+3600000;if(!Number.isFinite(end)||end<=start)return null;
 return {starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()};
}
export function contestPeriodError(start:string|null,end:string|null,label:string):string|null{if(start&&!Number.isFinite(new Date(start).getTime())||end&&!Number.isFinite(new Date(end).getTime()))return `${label} 시작·마감 시각을 확인해 주세요.`;if(start&&end&&new Date(end).getTime()<=new Date(start).getTime())return `${label} 마감은 시작 이후로 지정해 주세요.`;return null;}
