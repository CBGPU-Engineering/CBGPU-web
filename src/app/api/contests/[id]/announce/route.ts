import { emailSender, SITE_URL, renderEmail } from '@/lib/email';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {collectAnnouncementRecipients,resolveAnnouncementEmails} from '@/lib/contestAnnouncementRecipients';
import { contestOrganizer, organizerBody, organizerReply } from '@/lib/contestOrganizerServer';

const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await contestOrganizer(request, id);
  if (actor.response) return actor.response;
  const parsed = await organizerBody(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body!;
  const title = typeof body.title === 'string' ? body.title.trim() : ''; const content = typeof body.content === 'string' ? body.content.trim() : '';
  const audience = body.audience === undefined ? 'all' : String(body.audience);
  if (!['all','confirmed','pending','waitlisted'].includes(audience)) return organizerReply({ error: '공지를 받을 참가자 범위를 확인해 주세요.' }, 400);
  if (!title || title.length > 150 || !content || content.length > 10000) return organizerReply({ error: '공지 제목과 내용을 확인해 주세요.' }, 400);

  const { client, user, contest } = actor;
  const { error: insertError } = await client.from('event_announcements').insert({ contest_id: id, author_id: user.id, title, content, audience });
  if (insertError) return organizerReply({ error: '공지를 게시하지 못했어요. 다시 시도해 주세요.' }, 500);
  if (!serviceKey || !resendKey) return organizerReply({ ok: true, emailed: 0, warning: '사이트 공지를 게시했어요. 서버 이메일 설정이 없어 메일은 생략했어요.' });

  let sent = 0;
  try {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false },global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal??AbortSignal.timeout(10000),cache:'no-store'})} });
  const recipients=await collectAnnouncementRecipients(async(from,to,signal)=>{
    let query=admin.from('event_registrations').select('id,user_id').eq('contest_id',id).not('status','in','(cancelled,declined)');
    if(audience!=='all')query=query.eq('status',audience);
    return await query.order('id',{ascending:true}).abortSignal(signal).range(from,to);
  });
  const {emails,missing}=await resolveAnnouncementEmails(recipients,async userId=>{
    const result=await admin.auth.admin.getUserById(userId);
    if(result.error)throw Error('ANNOUNCEMENT_EMAIL_LOOKUP_UNAVAILABLE');
    return result.data.user?.email??null;
  });
  const resend = new Resend(resendKey);
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map(email => ({ from: emailSender(), to: email, subject: `[${contest.title}] ${title}`, html: renderEmail({ title, preview: `[${contest.title}] ${title}`, description: contest.title + '의 새 공지입니다.', bodyHtml: `<div style="white-space:pre-wrap;line-height:1.8;font-size:15px;color:#374151;">${esc(content)}</div>`, buttonLabel: '행사 페이지 열기', buttonUrl: SITE_URL + '/contests/' + encodeURIComponent(id) }) }));
    const { error } = await resend.batch.send(batch);
    if (error) return organizerReply({ ok: true, emailed: sent, warning: '사이트 공지는 게시했지만 일부 알림 메일을 보내지 못했어요.' });
    sent += batch.length;
  }
  return organizerReply({ ok: true, emailed: sent,...(missing?{warning:'사이트 공지는 게시했지만 이메일 주소가 없는 일부 계정에는 메일을 보내지 못했어요.'}:{}) });
  } catch { return organizerReply({ ok: true, emailed: sent, warning: '공지는 게시했지만 알림 메일 처리 결과를 확인하지 못했어요. 공지를 다시 게시하지 않아도 돼요.' }); }
}
