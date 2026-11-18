import { emailSender, SITE_URL, renderEmail } from '@/lib/email';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { contestOrganizer, contestUuid, organizerBody, organizerReply } from '@/lib/contestOrganizerServer';

const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const labels = { confirmed: '참가 확정', pending: '승인 대기', waitlisted: '대기 명단', declined: '승인 거절', cancelled: '신청 취소' } as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await contestOrganizer(request, id);
  if (actor.response) return actor.response;
  const parsed = await organizerBody(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body!;
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : [];
  const status = String(body.status) as keyof typeof labels;
  if (!ids.length || ids.length > 200 || ids.some(id => typeof id !== 'string' || !contestUuid(id)) || !Object.hasOwn(labels, status)) return organizerReply({ error: '참가자 ID와 상태를 확인해 주세요. 한 번에 최대 200명까지 변경할 수 있어요.' }, 400);
  const { client } = actor;
  const { data, error } = await client.from('event_registrations').update({ status }).eq('contest_id', id).in('id', ids).select('user_id');
  if (error) return organizerReply({ error: '참가 상태를 변경하지 못했어요. 권한과 참가 내역을 확인해 주세요.' }, 403);
  if (!data?.length) return organizerReply({ ok: true, changed: 0, emailed: 0 });
  if (!serviceKey || !resendKey) return organizerReply({ ok: true, changed: data.length, emailed: 0, warning: '참가 상태는 변경했지만 알림 메일을 보낼 수 없어 생략했어요.' });

  let sent = 0;
  try {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { contest } = actor;
  const emails = (await Promise.all(data.map(async row => (await admin.auth.admin.getUserById(row.user_id)).data.user?.email))).filter((email): email is string => !!email);
  const resend = new Resend(resendKey);
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map(email => ({ from: emailSender(), to: email, subject: `[${contest?.title || '교내 대회'}] ${labels[status]}`, html: renderEmail({ title: labels[status], preview: `[${contest?.title || '교내 대회'}] ${labels[status]}`, description: (contest?.title || '교내 대회') + ' 신청 상태가 ' + labels[status] + ' 상태로 변경되었어요.', buttonLabel: '행사 페이지에서 확인하기', buttonUrl: SITE_URL + '/contests/' + encodeURIComponent(id) }) }));
    const { error: emailError } = await resend.batch.send(batch); if (emailError) break; sent += batch.length;
  }
  return organizerReply({ ok: true, changed: data.length, emailed: sent, ...(sent < emails.length ? { warning: '참가 상태는 변경했지만 일부 알림 메일을 보내지 못했어요.' } : {}) });
  } catch { return organizerReply({ ok: true, changed: data.length, emailed: sent, warning: '참가 상태는 변경했지만 알림 메일 처리 결과를 확인하지 못했어요. 상태 변경을 다시 실행하지 않아도 돼요.' }); }
}
