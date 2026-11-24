import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import axe from 'axe-core';

const origin = 'http://127.0.0.1:14631';
const artifact = process.env.CBGPU_PREVIEW_COMPUTE_OUTPUT || '/tmp/cbgpu-v2-compute';
const user = {
  id: 'e6036a90-5978-4ce4-ad9c-1f2e0ea6af56',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'compute-fixture@example.invalid',
  user_metadata: { full_name: '테스트 사용자' },
  app_metadata: {},
};
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'c3ludGhldGlj',
].join('.');
const school = {
  id: 'fixture-compute',
  official_name: '예시과학고등학교',
  display_name: '예시과학고등학교',
  type: 'HIGH',
  region: '충청북도',
  status: 'APPROVED',
  features: ['gpu_compute'],
};
const projectId = '08de2965-aa27-4ac3-b884-65cd26a95469';
const chatId = 'a53344aa-6a66-40be-9792-ee9c118241aa';
const resourceId = '056e71c6-fc68-4406-a2f5-e063b3e413b3';
const reservationId = '83cd0db1-ea04-48da-8e0e-ee5028d0410a';
const jobId = '031507ad-c986-470c-bd47-22d60118b194';
const notebookPath = '/notebooks/' + jobId + '/lab';
const resource = {
  id: resourceId,
  node_id: 'synthetic-node',
  school_id: school.id,
  name: '연구실 GPU',
  memory_total_mib: 24576,
  state: 'READY',
  execution_enabled: true,
  execution_ready: true,
  transport_ready: true,
};
const session = {
  access_token: token,
  refresh_token: 'synthetic-refresh',
  token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  user,
};
const chat = { id: chatId, title: '예시 대화', updated: Math.floor(Date.now() / 1000), messages: [] };
const project = {
  id: projectId,
  slug: 'synthetic-site',
  repository: 'https://github.com/example/synthetic',
  branch: 'main',
  domain: 'synthetic.front.example.invalid',
  created_at: new Date().toISOString(),
  deployments: [],
  collaboration_role: 'viewer',
};
const requestedWidths = new Set((process.env.CBGPU_PREVIEW_COMPUTE_WIDTHS || '').split(',').map(Number).filter(Boolean));
const viewports = [[375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]
  .filter(([width]) => !requestedWidths.size || requestedWidths.has(width));
assert.ok(viewports.length, 'At least one supported test viewport is required.');
const note = {
  id: '3782eb3d-70a6-4800-9d88-55eaf79ffbda',
  user_id: user.id,
  title: '예시 실험 기록',
  content: '센서의 노이즈를 시간대별로 기록했어요.',
  tags: ['관측'],
  is_shared: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const routes = ['/ai', '/compute', '/dashboard', '/dashboard/ssh-guide', '/deploy', '/deploy/new', '/deploy/' + projectId, '/server', '/server/new', '/server/' + projectId, '/server/' + projectId + '/open', '/notes', '/latex'];

await mkdir(artifact, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: width === 430 ? 'dark' : 'light',
      isMobile: width < 600,
      hasTouch: width < 600,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    let allowGpu = true;
    let bookings: { id: string; resource_id: string; owner_id: string; starts_at: string; ends_at: string; status: string }[] = [];
    let job: { id: string; reservation_id: string; status: string; ends_at: string } | null = null;
    let launches = 0;
    let writes = 0;
    let aiMessages = 0;
    let gpuReads = 0;
    const errors: string[] = [];
    const unhandled: string[] = [];
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const pathname = url.pathname;
      const method = request.method();
      if (url.origin !== origin) {
        unhandled.push('External request: ' + url.origin + pathname);
        return route.abort();
      }
      if (pathname.startsWith('/new') || pathname.startsWith('/__nextjs_')) return route.continue();
      if (pathname.startsWith('/brand/v1/') && /\/(symbol|horizontal|wordmark)_(black|white)\.svg$/.test(pathname)) {
        return route.fulfill({ contentType: 'image/svg+xml', body: await readFile('public' + pathname) });
      }
      if (pathname === '/backend/auth/v1/token' && method === 'POST') return route.fulfill({ json: session });
      if (pathname === '/backend/auth/v1/user') return route.fulfill({ json: user });
      if (pathname === '/backend/rest/v1/rpc/cbgpu_self_resource_access') {
        assert.equal(method, 'POST');
        return route.fulfill({ json: { school_id: 'cbsh', resources: { school_compute: false } } });
      }
      if (pathname.startsWith('/backend/rest/v1/')) {
        if (method !== 'GET') unhandled.push(method + ' ' + pathname);
        if (pathname.endsWith('/research_notes')) return route.fulfill({ json: url.searchParams.get('user_id') === 'eq.' + user.id ? [note] : [] });
        return route.fulfill({ json: pathname.endsWith('/profiles') ? { id: user.id, is_approved: true } : [] });
      }
      if (pathname === '/api/schools/memberships') {
        return route.fulfill({ json: {
          current_school_id: school.id,
          items: [{ id: 'fixture-membership', user_id: user.id, school_id: school.id, membership_type: 'STUDENT', status: 'ACTIVE', verified: true, school }],
        } });
      }
      if (pathname === '/api/schools/resource-contexts') return route.fulfill({ json: {
        current_school_id: school.id,
        items: [{ school_id: school.id, school, type: 'MEMBERSHIP', membership_id: 'fixture-membership', resources: ['gpu', 'ai'], expires_at: null, can_administer: false }],
        server_time: new Date().toISOString(),
      } });
      if (pathname === '/api/schools/schools/' + school.id + '/resource-access') return route.fulfill({ json: {
        school_id: school.id, context_type: 'MEMBERSHIP', legacy_cbsh_access: false, expires_at: null,
        resources: { gpu: allowGpu, ai: true, study: false, school_storage: false, fabrication: false, school_compute: false, contests: false, central_cpu: false },
        reasons: { gpu: 'FEATURE_DISABLED' }, server_time: new Date().toISOString(),
      } });
      if (pathname.startsWith('/api/ai/') || pathname.startsWith('/api/compute/')) {
        assert.equal(request.headers().authorization, 'Bearer ' + token);
      }
      if (pathname === '/api/ai/chats') {
        return route.fulfill({ json: method === 'POST' ? { chat } : { chats: [] } });
      }
      if (pathname === '/api/ai/projects') return route.fulfill({ json: { projects: [] } });
      if (pathname === '/api/ai/chats/' + chatId + '/messages' && method === 'POST') {
        aiMessages++;
        const input = request.postDataJSON();
        assert.equal(input.content, '테스트 질문을 보냅니다.');
        assert.equal(input.web_search, true);
        return route.fulfill({ json: { chat: { ...chat, messages: [
          { id: 'synthetic-user-message', content: input.content, role: 'user', state: 'succeeded' },
          { id: 'synthetic-answer', content: '', role: 'assistant', state: 'running' },
        ] } } });
      }
      if (pathname === '/api/ai/chats/' + chatId + '/events' && method === 'GET') {
        const delta = (text: string, offset: number) => 'data: ' + JSON.stringify({ type: 'delta', id: 'synthetic-answer', text, offset }) + '\n\n';
        const done = JSON.stringify({ type: 'done', message: { id: 'synthetic-answer', content: '예시 답변입니다.', state: 'succeeded' } });
        const body = delta('예시 ', 0) + delta('답변입니다.', 3) + 'data: ' + done + '\n\ndata: [DONE]\n\n';
        return route.fulfill({ contentType: 'text/event-stream', body });
      }
      const gpu = '/api/compute/schools/' + school.id + '/gpu/';
      if (pathname === gpu + 'resources' && method === 'GET') {
        gpuReads++;
        return route.fulfill({ json: { items: [resource] } });
      }
      if (pathname === gpu + 'reservations' && method === 'GET') return route.fulfill({ json: { items: bookings } });
      if (pathname === gpu + 'reservations/' + reservationId + '/notebook' && method === 'GET') return route.fulfill({ json: { job, notebook_url: job ? notebookPath : null } });
      if (pathname === gpu + 'reservations/' + reservationId + '/launch' && method === 'POST') {
        launches++;
        const input = request.postDataJSON();
        assert.equal(input.temporary_storage_consent, true);
        assert.match(input.client_request_id, /^[a-f0-9-]{36}$/);
        job = { id: jobId, reservation_id: reservationId, status: 'RUNNING', ends_at: bookings[0].ends_at };
        return route.fulfill({ json: { job, notebook_url: notebookPath } });
      }
      if (pathname === gpu + 'reservations/' + reservationId + '/session' && method === 'POST') {
        return route.fulfill({ json: { job_id: jobId, expires_at: new Date(Date.now() + 60_000).toISOString(), url: notebookPath } });
      }
      if (pathname === notebookPath && method === 'GET') {
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Test notebook</title><p>Synthetic notebook session</p>' });
      }
      if (pathname === gpu + 'resources/' + resourceId + '/reservations' && method === 'POST') {
        writes++;
        const dates = request.postDataJSON();
        assert.ok(Date.parse(dates.starts_at) > Date.now());
        assert.ok(Date.parse(dates.ends_at) > Date.parse(dates.starts_at));
        const reservation = { ...dates, id: reservationId, resource_id: resourceId, owner_id: user.id, status: 'RESERVED', created_at: new Date().toISOString() };
        bookings = [reservation];
        return route.fulfill({ json: { reservation } });
      }
      if (pathname === '/api/deploy/projects' && method === 'GET') return route.fulfill({ json: { projects: [project] } });
      if (pathname === '/api/deploy/projects/' + projectId && method === 'GET') return route.fulfill({ json: { project } });
      if (pathname === '/api/deploy/servers/projects' && method === 'GET') {
        return route.fulfill({ json: { projects: [{ id: projectId, name: '예시 서버', status: 'approved', deploy_type: 'git', git_url: project.repository, access_scope: 'private' }] } });
      }
      if (pathname === '/api/latex/projects' && method === 'GET') {
        return route.fulfill({ json: { projects: [{ id: projectId, name: '예시 논문', compiler: 'pdflatex', role: 'owner', updated_at: new Date().toISOString() }] } });
      }
      unhandled.push(method + ' ' + pathname);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    page.on('pageerror', error => errors.push(error.message));
    for (const pathname of routes) {
      const response = await page.goto(origin + '/new' + pathname);
      assert.equal(response?.status(), 200, pathname);
      await page.getByRole('link', { name: '로그인하기' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, pathname);
    }
    assert.equal(gpuReads, 0);
    assert.equal(aiMessages, 0);
    assert.equal(writes, 0);

    await page.goto(origin + '/new/ai');
    await page.getByRole('link', { name: '로그인하기' }).click();
    await page.getByLabel('이메일').fill(user.email);
    await page.getByLabel('비밀번호', { exact: true }).fill('synthetic-test-password');
    await page.getByRole('button', { name: '로그인하기' }).click();
    await page.waitForURL('**/new/ai');
    await page.getByRole('heading', { name: '무엇을 같이 풀어볼까요?' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'AI signed in');
    await page.screenshot({ path: artifact + '/ai-intro-' + width + '.png' });
    if (width === 390 || width === 1440) {
      await page.addScriptTag({ content: axe.source });
      const accessibility = await page.evaluate(async () => {
        const { axe: audit } = window as Window & { axe: typeof axe };
        const results = await audit.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
        return results.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) }));
      });
      assert.deepEqual(accessibility, [], 'AI accessibility at ' + width);
    }
    await page.getByRole('button', { name: '글 요약하기' }).click();
    await page.getByRole('textbox', { name: '메시지 입력' }).fill('테스트 질문을 보냅니다.');
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
    await page.getByText('예시 답변입니다.', { exact: true }).waitFor();
    assert.equal(aiMessages, 1);
    assert.equal(new URL(page.url()).pathname, '/new/ai');
    assert.equal(new URL(page.url()).searchParams.get('c'), chatId);
    await page.screenshot({ path: artifact + '/ai-' + width + '.png' });

    await page.goto(origin + '/new/compute');
    await page.getByRole('heading', { name: resource.name }).first().waitFor().catch(async error => {
      await page.screenshot({ path: artifact + '/gpu-failure-' + width + '.png' });
      console.error(JSON.stringify({ path: page.url(), content: await page.locator('main').innerText(), errors, unhandled }));
      throw error;
    });
    await page.screenshot({ path: artifact + '/gpu-' + width + '.png' });
    await page.getByRole('button', { name: '예약하기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'GPU 예약' });
    assert.ok(await dialog.isVisible());
    assert.ok(await dialog.getByLabel('시작 시간').evaluate(input => input === document.activeElement));
    assert.equal(await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
    }), true, 'GPU reservation dialog fits viewport');
    await page.screenshot({ path: artifact + '/gpu-dialog-' + width + '.png' });
    await dialog.getByRole('button', { name: 'GPU 예약하기', exact: true }).click();
    await page.getByText('GPU를 예약했어요.', { exact: false }).first().waitFor();
    assert.equal(writes, 1);
    await page.getByText('예약 시간 대기').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'GPU signed in');

    if (width === 390) {
      bookings = bookings.map(row => ({ ...row, starts_at: new Date(Date.now() - 60_000).toISOString() }));
      await page.goto(origin + '/new/compute');
      await page.getByRole('button', { name: 'Jupyter 실행', exact: true }).click();
      const launch = page.getByRole('dialog', { name: 'Jupyter 실행' });
      const consent = launch.getByRole('button', { name: '동의하고 실행 요청' });
      assert.equal(await consent.isEnabled(), false);
      await launch.getByRole('checkbox').check();
      await consent.click();
      await page.getByRole('button', { name: 'Jupyter 열기' }).click();
      await page.waitForURL('**' + notebookPath);
      assert.equal(launches, 1);
      assert.equal(await page.locator('body').innerText(), 'Synthetic notebook session');
    }

    allowGpu = false;
    const before = gpuReads;
    await page.goto(origin + '/new/compute');
    await page.getByRole('heading', { name: '이 학교의 GPU를 이용할 수 없어요' }).waitFor();
    assert.equal(gpuReads, before, 'An unauthorized client cannot read inventory');
    assert.equal(await page.getByText(resource.name).count(), 0);
    await page.goto(origin + '/new/deploy');
    await page.getByRole('link', { name: /synthetic-site/ }).click();
    await page.waitForURL('**/new/deploy/' + projectId);
    await page.getByRole('heading', { name: 'synthetic-site' }).waitFor();
    await page.screenshot({ path: artifact + '/deploy-' + width + '.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Deployment detail signed in');
    if (width === 390 || width === 1440) {
      await page.goto(origin + '/new/server');
      await page.getByRole('link', { name: /예시 서버/ }).waitFor();
      await page.screenshot({ path: artifact + '/server-' + width + '.png' });
      await page.getByRole('button', { name: '새 프로젝트' }).click();
      await page.waitForURL('**/new/server/new');
      await page.getByText('프로젝트 기본 정보', { exact: true }).waitFor();
      await page.goto(origin + '/new/notes');
      await page.getByRole('button', { name: '노트 열기: ' + note.title }).click();
      assert.equal(await page.getByLabel('노트 내용').inputValue(), note.content);
      await page.getByRole('button', { name: '미리보기', exact: true }).click();
      await page.getByText(note.content, { exact: true }).waitFor();
      await page.screenshot({ path: artifact + '/notes-' + width + '.png' });
      await page.getByRole('button', { name: '노트 목록으로 돌아가기' }).click();
      await page.getByRole('navigation', { name: '연구 도구' }).getByRole('link', { name: 'LaTeX' }).click();
      await page.waitForURL('**/new/latex');
      await page.getByRole('button', { name: /예시 논문/ }).filter({ hasText: 'pdflatex' }).waitFor();
      await page.screenshot({ path: artifact + '/latex-' + width + '.png' });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unhandled, []);
    await context.close();
    console.log('Passed compute preview flows at ' + width);
  }
} finally {
  await browser.close();
}
