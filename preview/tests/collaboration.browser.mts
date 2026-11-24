import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import axe from 'axe-core';

const origin = new URL(process.env.CBGPU_COLLABORATION_ORIGIN || 'http://127.0.0.1:14631').origin;
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const output = process.env.CBGPU_PREVIEW_OUTPUT || '/tmp/cbgpu-v2-collaboration';
await mkdir(output, { recursive: true });

const userId = 'e6036a90-5978-4ce4-ad9c-1f2e0ea6af56';
const hostId = 'b6036a90-5978-4ce4-ad9c-1f2e0ea6af57';
const contestId = 'a53344aa-6a66-40be-9792-ee9c118241aa';
const managedId = 'a53344aa-6a66-40be-9792-ee9c118241bb';
const projectId = '08de2965-aa27-4ac3-b884-65cd26a95469';
const schoolId = 'fixture-school-0';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'collaboration@example.invalid',
  user_metadata: { full_name: '예시 학생' }, app_metadata: {}, created_at: '2026-11-01T00:00:00Z' };
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'c3ludGhldGlj',
].join('.');
const session = { access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user };
const now = '2026-11-25T06:00:00.000Z';
const contest = {
  id: contestId, host_id: hostId, title: '교내 연구 발표회', description: '교실 데이터를 분석한 결과를 발표해요.',
  lifecycle_status: 'published', location_type: 'offline', location_name: '본관 시청각실', address: '',
  visibility: 'public', capacity: 20, waitlist_enabled: true, approval_required: false,
  is_open: true, registration_open: true, event_start_at: '2026-12-10T03:00:00.000Z', event_end_at: '2026-12-10T06:00:00.000Z',
  registration_opens_at: '2026-11-24T00:00:00.000Z', registration_closes_at: '2026-12-01T00:00:00.000Z',
  participation_mode: 'individual', registration_questions: [], fields: [
    { id: 'summary', type: 'text', label: '연구 요약', description: '', required: true, extensions: '', max_size_mb: 1 },
  ],
};
const hosted = { ...contest, id: managedId, host_id: userId, title: '내 과학 탐구전' };
const awards = {
  categories: [], showcases: [], my_showcases: [], can_vote: false, can_manage: false, results_available: false,
  settings: { enabled: false, starts_at: null, closes_at: null, results_published: false }, server_time: now,
};

const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce',
      hasTouch: width === 390, isMobile: width === 390, serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const unexpected: string[] = [];
      const errors: string[] = [];
      const mutations: string[] = [];
      let active = false;
      let dataRequests = 0;
      let registration: Record<string, unknown> | null = null;
      let submission: Record<string, unknown> | null = null;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        const { pathname: endpoint } = url;
        if (url.origin === origin && endpoint.startsWith('/__nextjs_')) return route.continue();
        if (url.origin === origin && (endpoint === '/new' || endpoint.startsWith('/new/'))) {
          assert.match(method, /^(GET|HEAD)$/);
          return route.continue();
        }
        const good = (json: unknown) => route.fulfill({ json });
        if (url.origin !== origin) {
          unexpected.push(url.origin + endpoint);
          return route.abort();
        }
        if (/^\/brand\/v1\/(horizontal|symbol)_(black|white)\.svg$/.test(endpoint)) {
          return route.fulfill({ path: path.join('public', endpoint) });
        }
        if (endpoint === '/api/auth/shared-session') {
          if (method === 'POST') active = true;
          return good(active ? { state: 'active', value: JSON.stringify(session) } : { state: 'empty', value: null });
        }
        if (endpoint === '/backend/auth/v1/token' && method === 'POST') {
          active = true;
          return good(session);
        }
        if (endpoint === '/backend/auth/v1/user' && request.headers().authorization === 'Bearer ' + token) return good(user);
        assert.equal(request.headers().authorization, 'Bearer ' + token, endpoint);
        dataRequests++;
        if (endpoint === '/api/schools/memberships') return good({
          current_school_id: schoolId,
          items: [{ id: 'membership', user_id: userId, school_id: schoolId, membership_type: 'STUDENT', verified: true, status: 'ACTIVE',
            school: { id: schoolId, official_name: '예시고등학교', display_name: '예시고등학교', status: 'APPROVED', features: ['community'] } }],
        });
        if (endpoint === '/api/schools/resource-contexts') return good({ current_school_id: null, items: [], server_time: now });
        if (endpoint === '/api/schools/message-mutes' || endpoint === '/api/schools/publications' && method === 'GET') return good({ items: [] });
        if (endpoint === '/api/schools/publications' && method === 'POST') {
          const payload = request.postDataJSON();
          assert.equal(payload.visibility, 'PRIVATE');
          assert.equal(payload.confirmed, false);
          assert.equal(payload.title, '교실 관찰');
          mutations.push('draft');
          return good({ project: { ...payload, id: projectId, status: 'DRAFT', updated_at: now } });
        }
        if (endpoint === '/api/schools/messages' && method === 'GET') {
          const scope = url.searchParams.get('scope');
          if (scope === 'SCHOOL') assert.equal(url.searchParams.get('school_id'), schoolId);
          if (scope === 'PUBLIC') assert.equal(url.searchParams.has('school_id'), false);
          return good({ items: [] });
        }
        if (endpoint === '/api/schools/messages' && method === 'POST') {
          const body = request.postDataJSON();
          assert.equal(body.scope, 'SCHOOL');
          assert.equal(body.school_id, schoolId);
          mutations.push('post');
          return good({ message: { id: 'fixture-message', user_id: userId, body: body.body, scope: 'SCHOOL', school_id: schoolId, created_at: now } });
        }
        if (endpoint === '/api/deploy/projects') return good({ projects: [{ id: projectId, slug: 'classroom-analysis', collaboration_role: 'viewer' }] });
        if (endpoint === '/api/deploy/servers/projects') return good({ projects: [] });
        if (endpoint === '/api/deploy/teams/frontend/' + projectId) return good({
          owner_id: hostId, owner: { user_id: hostId, name: '공동작업 예시', email: 'owner@example.invalid' },
          my_role: 'viewer', members: [{ user_id: userId, name: '예시 학생', email: user.email, role: 'viewer' }],
        });
        if (endpoint === '/backend/rest/v1/profiles') return good({ id: userId, is_approved: true, full_name: '예시 학생' });
        if (endpoint === '/backend/rest/v1/rpc/contest_server_time') return good(now);
        if (endpoint === '/backend/rest/v1/rpc/contest_awards_api') return good(awards);
        if (endpoint === '/backend/rest/v1/contests' && method === 'GET') {
          const id = url.searchParams.get('id');
          return good(id ? [id === 'eq.' + contestId ? contest : hosted] : [contest, hosted]);
        }
        if (endpoint === '/backend/rest/v1/rpc/register_contest_entry' && method === 'POST') {
          const payload = request.postDataJSON();
          assert.equal(payload.p_contest_id, contestId);
          assert.equal(payload.p_attendee_name, '예시 학생');
          mutations.push('registration');
          registration = { id: 'fixture-registration', user_id: userId, contest_id: contestId, attendee_name: '예시 학생',
            status: 'confirmed', ticket_code: 'PREVIEW-CODE', answers: {}, created_at: now, checked_in_at: null };
          return good(registration);
        }
        if (endpoint === '/backend/rest/v1/event_registrations' && method === 'GET') return good(registration ? [registration] : []);
        if (endpoint === '/backend/rest/v1/contest_submissions' && method === 'GET') {
          return good(submission && url.searchParams.get('contest_id') === 'eq.' + contestId ? [submission] : []);
        }
        if (endpoint === '/backend/rest/v1/contest_submissions' && method === 'POST') {
          const payload = request.postDataJSON();
          assert.equal(payload.contest_id, contestId);
          assert.equal(payload.answers.summary, '합성 자료만 저장합니다.');
          mutations.push('submission');
          submission = { ...payload, id: 'fixture-submission', submitted_at: now };
          return good(submission);
        }
        if (method === 'GET' && [
          'printer_managers', 'event_hosts', 'event_sessions', 'event_announcements',
          'event_access_details', 'contest_team_members', 'contest_teams',
        ].some(table => endpoint === '/backend/rest/v1/' + table)) return good([]);
        unexpected.push(method + ' ' + endpoint);
        return route.fulfill({ status: 404, json: { message: 'Unexpected fixture request' } });
      });

      const screenshots = async (label: string) => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label + ' overflows');
        await page.screenshot({ path: path.join(output, label + '-' + width + '.png'), animations: 'disabled' });
        await page.addScriptTag({ content: axe.source });
        const violations = await page.evaluate(async () => {
          const report = await (window as Window & { axe: typeof axe }).axe.run({
            runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          });
          return report.violations.map(item => ({ rule: item.id, elements: item.nodes.map(node => node.target) }));
        });
        assert.deepEqual(violations, [], label + ' accessibility at ' + width);
      };
      const participant = '/new/contests/' + contestId + '/participate';
      await page.goto(origin + participant + '?team=synthetic-invitation');
      const login = page.getByRole('main').getByRole('link', { name: '로그인하기' });
      await login.waitFor();
      assert.equal(dataRequests, 0);
      assert.deepEqual(mutations, []);
      assert.equal(new URL(await login.getAttribute('href') || '', origin).searchParams.get('next'), participant + '?team=synthetic-invitation');
      await login.click();
      await page.getByLabel('이메일').fill(user.email);
      await page.getByLabel('비밀번호', { exact: true }).fill('SyntheticPreviewPassword');
      await page.getByRole('button', { name: '로그인하기' }).click();
      await page.waitForURL(origin + participant + '?team=synthetic-invitation');
      await page.getByRole('heading', { name: contest.title }).waitFor();
      assert.deepEqual(mutations, []);
      await page.getByLabel('참가자 이름', { exact: true }).fill('예시 학생');
      await page.getByRole('button', { name: '참가 신청하기' }).click();
      await page.getByText('참가 확정', { exact: true }).waitFor();
      await page.getByLabel(/제출자 이름/).fill('예시 학생');
      await page.getByLabel('연구 요약').fill('합성 자료만 저장합니다.');
      await page.getByRole('button', { name: '작품 제출하기' }).click();
      await page.getByRole('button', { name: '수정 내용 다시 제출하기' }).waitFor();
      await page.getByRole('heading', { name: '제출을 완료했어요', exact: true }).waitFor();
      await screenshots('contest-submitted');

      await page.goto(origin + '/new/contests/' + contestId + '/manage');
      await page.getByRole('heading', { name: '대회 운영진만 관리할 수 있어요' }).waitFor();
      assert.match(await page.getByRole('link', { name: '참가자 화면으로' }).getAttribute('href') || '', /\/new\/contests\/.+\/participate$/);
      await page.goto(origin + '/new/contests/workspace');
      await page.getByRole('button', { name: '운영하는 대회' }).click();
      await page.getByRole('link', { name: hosted.title + ' 관리' }).click();
      await page.waitForURL(origin + '/new/contests/' + managedId + '/manage');
      await page.getByRole('heading', { name: hosted.title, level: 1 }).waitFor();
      await screenshots('contest-management-opened');
      await page.getByRole('button', { name: '제출물', exact: true }).click();
      await page.getByText('아직 작품 제출물이 없어요.', { exact: false }).waitFor();
      await screenshots('contest-management');
      await page.getByRole('link', { name: '참가자 화면 보기' }).click();
      await page.getByText('참가자 화면 미리보기', { exact: true }).first().waitFor();

      await page.goto(origin + '/new/community/boards');
      await page.getByRole('heading', { name: '커뮤니티' }).waitFor();
      await page.getByRole('navigation', { name: '커뮤니티 게시판' }).getByRole('button', { name: '예시고등학교' }).click();
      await page.getByRole('button', { name: '글쓰기', exact: true }).click();
      const compose = page.getByRole('dialog', { name: '글쓰기' });
      await compose.getByLabel('게시글 내용').fill('예시 학생의 게시글');
      await screenshots('community-compose');
      await compose.getByRole('button', { name: '게시글 등록', exact: true }).click();
      await page.getByRole('heading', { name: '예시 학생의 게시글' }).waitFor();

      await page.goto(origin + '/new/projects/manage');
      await page.getByRole('link', { name: 'classroom-analysis 공동작업자 확인' }).click();
      await page.getByRole('heading', { name: '함께 만드는 프로젝트' }).waitFor();
      await page.getByText('공동작업 예시').waitFor();
      assert.equal(await page.getByText('CBGPU 이메일', { exact: true }).count(), 0);
      await screenshots('project-viewer-team');
      await page.getByRole('button', { name: '예시 학생 프로젝트 나가기' }).click();
      const leave = page.getByRole('dialog', { name: '프로젝트에서 나갈까요?' });
      await leave.getByRole('button', { name: '계속 함께하기' }).click();
      await leave.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('button', { name: '예시 학생 프로젝트 나가기' }).count(), 1);
      await page.goto(origin + '/new/projects/manage/publication');
      await page.getByRole('heading', { name: '다른 사람에게 보여줄 소개를 작성해요' }).waitFor();
      assert.equal(await page.getByRole('button', { name: '공개 소개 게시' }).isDisabled(), true);
      await page.getByLabel('소개 제목', { exact: true }).fill('교실 관찰');
      await page.getByLabel(/소개 주소 이름/).fill('classroom-observation');
      await page.getByRole('button', { name: '비공개 초안 저장' }).click();
      await page.getByText('비공개 초안으로 저장했어요.', { exact: false }).waitFor();
      await screenshots('project-publication');
      await page.goto(origin + '/new/contests/new');
      await page.getByRole('heading', { name: '대회 만들기', level: 1 }).waitFor();
      await screenshots('contest-create');
      assert.deepEqual(mutations, ['registration', 'submission', 'post', 'draft']);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(errors, []);
      console.log('Verified synthetic collaboration flows at width ' + width);
    } catch (error) {
      const page = context.pages()[0];
      await page.screenshot({ path: path.join(output, 'failure-' + width + '.png'), animations: 'disabled' });
      console.error(page.url(), await page.getByRole('main').ariaSnapshot({ timeout: 2000 }).catch(() => ''));
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
