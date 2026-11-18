import { createClient } from '@supabase/supabase-js';
import { readJsonBody, RequestBodyError } from './requestSecurity';

export const organizerHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export const organizerReply = (body: unknown, status = 200) => Response.json(body, { status, headers: organizerHeaders });
export const contestUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Verify the actual caller before any mutation or privileged recipient lookup. RLS remains enabled. */
export async function contestOrganizer(request: Request, contestId: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { response: organizerReply({ error: '로그인이 필요해요.' }, 401) };
  if (!contestUuid(contestId)) return { response: organizerReply({ error: '대회를 찾을 수 없어요.' }, 404) };
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response: organizerReply({ error: '잠시 후 다시 시도해 주세요.' }, 503) };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000), cache: 'no-store' }) } });
  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error && (error.status === 0 || (error.status || 0) >= 500 || error.name === 'AuthRetryableFetchError')) return { response: organizerReply({ error: '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503) };
    if (error || !user || user.deleted_at) return { response: organizerReply({ error: '다시 로그인해 주세요.' }, 401) };
    const [event, host] = await Promise.all([
      client.from('contests').select('id,title,host_id').eq('id', contestId).maybeSingle(),
      client.from('event_hosts').select('role').eq('contest_id', contestId).eq('user_id', user.id).maybeSingle(),
    ]);
    if (event.error || host.error) return { response: organizerReply({ error: '운영 권한을 확인하지 못했어요. 다시 시도해 주세요.' }, 503) };
    if (!event.data || (event.data.host_id !== user.id && host.data?.role !== 'manager')) return { response: organizerReply({ error: '대회 운영 권한이 없어요.' }, 403) };
    return { client, user, contest: event.data };
  } catch { return { response: organizerReply({ error: '운영 권한을 확인하지 못했어요. 다시 시도해 주세요.' }, 503) }; }
}

export async function organizerBody(request: Request) {
  try {
    const body = await readJsonBody(request, 64 * 1024);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestBodyError(400);
    return { body: body as Record<string, unknown> };
  } catch (error) {
    return { response: organizerReply({ error: '요청 내용을 확인해 주세요.' }, error instanceof RequestBodyError ? error.status : 400) };
  }
}
