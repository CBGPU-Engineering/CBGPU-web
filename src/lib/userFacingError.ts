/** Format error descriptions for Korean user screens only.
 * Never pass titles, user content, code, logs, AI answers or successful payloads here.
 * This changes presentation only: callers retain status, identity and retry behavior.
 */
const knownErrors: Record<string, string> = {
  'unauthorized': '로그인 상태를 확인한 뒤 다시 이용해 주세요.',
  'not authorized': '이 작업을 수행할 권한을 확인해 주세요.',
  'forbidden': '이 작업을 수행할 권한을 확인해 주세요.',
  'permission denied': '이 작업을 수행할 권한을 확인해 주세요.',
  'login required': '로그인한 뒤 다시 이용해 주세요.',
  'authentication required': '로그인한 뒤 다시 이용해 주세요.',
  'jwt expired': '로그인이 만료됐어요. 다시 로그인해 주세요.',
  'invalid jwt': '로그인 상태를 확인한 뒤 다시 로그인해 주세요.',
  'invalid login credentials': '이메일과 비밀번호를 다시 확인해 주세요.',
  'invalid api key': 'API 키를 다시 확인해 주세요.',
  'not found': '요청한 항목을 찾지 못했어요. 목록에서 다시 확인해 주세요.',
  'project not found': '프로젝트를 찾지 못했어요. 프로젝트 목록에서 다시 확인해 주세요.',
  'too many requests': '요청이 많아요. 잠시 후 다시 이용해 주세요.',
  'rate limit exceeded': '요청이 많아요. 잠시 후 다시 이용해 주세요.',
  'request timeout': '요청 결과를 확인하지 못했어요. 목록에서 처리 상태를 확인해 주세요.',
  'ai job stopped': 'AI 작업이 중단됐어요. AI 작업 목록에서 상태를 확인해 주세요.',
  'local ai failed': 'AI 처리 결과를 확인하지 못했어요. AI 작업 목록에서 상태를 확인해 주세요.',
  'no gpu became available in time. check your cbgpu ai jobs.': 'GPU 대기 시간이 길어졌어요. AI 작업 목록에서 처리 상태를 확인해 주세요.',
  'invalid_session': '로그인 상태를 확인한 뒤 다시 로그인해 주세요.',
  'session_expired': '로그인이 만료됐어요. 다시 로그인해 주세요.',
  'fresh_identity_required': '로그인 상태를 확인한 뒤 다시 이용해 주세요.',
};

export function userFacingError(message: unknown, fallback: string): string {
  if (typeof message !== 'string') return fallback;
  const text = message.trim();
  if (!text || text.length > 1000) return fallback;
  const keys = [text.toLowerCase().replace(/[.!]$/, ''), text.toLowerCase()];
  for (const key of keys) if (Object.hasOwn(knownErrors, key)) return knownErrors[key];
  // Keep ordinary Korean explanations, including product names such as Docker or SQL.
  // Reject diagnostic structures rather than those names alone.
  if (!/[가-힣]/.test(text)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
    || /<!doctype\b|<\/?[a-z][^>]*>|\b(?:SQLSTATE|PGRST\d*|PostgrestError|Traceback|private_schema)\b/i.test(text)
    || /\b(?:syntax error at|violates? .{0,80}constraint|duplicate key value|relation .{0,80}does not exist|column .{0,80}does not exist|permission denied for|row-level security|invalid input syntax for|stack trace)\b/i.test(text)
    || /\b(?:select\b[\s\S]{0,300}\bfrom|insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i.test(text)
    || /(?:^|\n)\s*at\s+\S+.*:\d+(?::\d+)?|\b(?:TypeError|ReferenceError|SyntaxError):/i.test(text)
    || /\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.|\b(?:postgres(?:ql)?):\/\//i.test(text)
    || text.split('\n').length > 6) return fallback;
  return text;
}
