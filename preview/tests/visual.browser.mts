import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { chromium } from 'playwright';
import axe from 'axe-core';

const output = process.env.CBGPU_PREVIEW_OUTPUT || '/tmp/cbgpu-v2-browser';
const port = 14630;
const origin = 'http://127.0.0.1:' + port;
const contestId = 'a53344aa-6a66-40be-9792-ee9c118241aa';
const contestBanner = '/api/public-assets/contests/' + contestId + '/banner';
const projectId = '08de2965-aa27-4ac3-b884-65cd26a95469';
const user = { id: 'e6036a90-5978-4ce4-ad9c-1f2e0ea6af56', aud: 'authenticated', role: 'authenticated', email: 'browser-test@example.invalid', user_metadata: { full_name: '박예시' }, app_metadata: {}, created_at: '2026-11-01T00:00:00Z' };
const school = { id: 'fixture-school-0', official_name: '예시과학고등학교', display_name: '예시과학고등학교', type: 'HIGH', region: '충청북도', status: 'APPROVED', features: ['school_life'], life_capabilities: { timetable: true, meal: true, news: false } };
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'c3ludGhldGlj',
].join('.');
const privateMarker = 'NOT_PUBLIC_TEST_FIELD';
const fixtures = {
  schools: Array.from({ length: 20 }, (_, index) => ({
    id: 'fixture-school-' + index,
    display_name: index === 0 ? '예시과학고등학교' : '예시학교 ' + (index + 1),
    region: '충청북도',
    status: 'APPROVED',
    public_description: '브라우저 검사 전용 학교입니다.',
    email: privateMarker,
  })),
  contests: [{
    id: contestId,
    title: '교내 연구 발표회',
    banner_url: contestBanner,
    organizer: '예시과학고등학교',
    description: '학생의 연구 결과를 발표하고 서로의 작업을 살펴봐요.',
    registration_closes_at: '2026-12-05T06:30:00Z',
    event_start_at: '2026-12-10T03:00:00Z',
    eligibility: '예시 학교 학생',
    participation_mode: 'team',
  }],
  projects: [{
    id: projectId,
    title: '교실 공기 기록',
    summary: '수업 시간에 교실의 공기를 측정하고 변화를 그래프로 정리했어요.',
    body_markdown: '측정한 자료를 분석해 **하루의 변화**를 살펴봤어요.\n\n![발표 자료](https://assets.example.invalid/private.png)',
    owner_id: privateMarker,
  }],
  community: [{
    id: 'fixture-post',
    title: '이번 주 과학 토론',
    body: '함께 이야기할 주제를 모으고 있어요.',
    board_name: '전국 공개 게시판',
    author_id: privateMarker,
  }],
};

const jsonServer = createServer((request, response) => {
  assert.equal(request.method, 'GET');
  const url = new URL(request.url!, origin);
  const [, version, kind, id] = url.pathname.split('/');
  const rows = fixtures[kind as keyof typeof fixtures];
  if (version !== 'v1' || !rows) { response.writeHead(404).end(); return; }
  const query = url.searchParams.get('query') || '';
  if (query === 'offline-test') { response.writeHead(503).end(); return; }
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || 24);
  const filtered = rows.filter(row => JSON.stringify(row).includes(query));
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(id ? { item: rows.find(row => row.id === id) ?? null } : {
    items: filtered.slice(offset, offset + limit), total: filtered.length,
  }));
});
await mkdir(output, { recursive: true });
jsonServer.listen(0, '127.0.0.1');
await once(jsonServer, 'listening');
const address = jsonServer.address();
assert.ok(address && typeof address !== 'string');
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'preview', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NEXT_TELEMETRY_DISABLED: '1',
    CBGPU_PUBLIC_BROWSING_V1: '1',
    CBGPU_PREVIEW_SHOWCASE: process.env.CBGPU_PREVIEW_SHOWCASE || '0',
    NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1: '1',
    CBGPU_PUBLIC_CONTENT_API_URL: 'http://127.0.0.1:' + address.port,
  },
  stdio: 'inherit',
});

process.once('uncaughtExceptionMonitor', () => app.kill('SIGTERM'));
process.once('SIGTERM', () => { app.kill('SIGTERM'); process.exit(143); });
process.once('SIGINT', () => { app.kill('SIGTERM'); process.exit(130); });

const results: object[] = [];
const screens = [[375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
const routes = [
  ['', 'home'], ['/services', 'services'], ['/schools', 'schools'],
  ['/schools/fixture-school-0', 'school'], ['/contests', 'contests'],
  ['/contests/' + contestId, 'contest'], ['/projects', 'projects'],
  ['/projects/' + projectId, 'project'], ['/community', 'community'], ['/auth/login', 'login'], ['/meal', 'meal-gated'], ['/timetable', 'timetable-gated'], ['/docs', 'docs'], ['/docs/school-integration', 'school-guide'],
] as const;

try {
  for (let attempt = 0; ; attempt++) {
    if (app.exitCode !== null || attempt >= 45) throw Error('Preview did not start');
    if (await fetch(origin + '/new').then(response => response.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const browser = await chromium.launch();
  try {
    const showcase = await fetch(origin + '/new/design-system');
    assert.equal(showcase.status, process.env.CBGPU_PREVIEW_SHOWCASE === '1' ? 200 : 404);
    for (const [width, height] of screens) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 600,
        hasTouch: width < 600,
        colorScheme: width === 430 ? 'dark' : 'light',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      const errors: string[] = [];
      const unexpected: string[] = [];
      let acceptLogin = false;
      let verifiedSchool = true;
      let mealState: 'ready' | 'empty' | 'error' = 'ready';
      const mealReads: string[] = [];
      const timetableReads: string[] = [];
      await context.addInitScript(() => {
        const paint = { lcp: 0, layoutShift: 0 };
        Object.defineProperty(window, '__previewPaint', { value: paint });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) paint.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!entry.hadRecentInput) paint.layoutShift += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === origin && url.pathname.startsWith('/new')) return route.continue();
        if (url.origin === origin && url.pathname === contestBanner) {
          return route.fulfill({ path: 'preview/public/visuals/study-space.webp', contentType: 'image/webp' });
        }
        if (url.origin === origin && url.pathname === '/backend/auth/v1/user') return route.fulfill({ json: user });
        if (url.origin === origin && url.pathname === '/backend/auth/v1/token' && acceptLogin) {
          return route.fulfill({ json: { access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user } });
        }
        if (url.origin === origin && url.pathname.startsWith('/backend/rest/v1/')) {
          return route.fulfill({ json: url.pathname.endsWith('/profiles') ? { id: user.id, is_approved: true } : [] });
        }
        if (url.origin === origin && url.pathname === '/api/schools/memberships') {
          assert.equal(request.headers().authorization, 'Bearer ' + token);
          return route.fulfill({ json: {
            current_school_id: school.id,
            items: [{ id: 'fixture-membership', user_id: user.id, school_id: school.id, membership_type: 'STUDENT', status: 'ACTIVE', verified: verifiedSchool, school }],
          } });
        }
        if (url.origin === origin && url.pathname === '/api/schools/resource-contexts') {
          return route.fulfill({ json: { current_school_id: null, items: [], server_time: new Date().toISOString() } });
        }
        if (url.origin === origin && url.pathname === '/api/timetable') {
          assert.equal(request.method(), 'GET');
          assert.equal(request.headers().authorization, 'Bearer ' + token);
          assert.equal(url.searchParams.get('school_id'), school.id);
          const grade = url.searchParams.get('grade')!;
          timetableReads.push(grade);
          return route.fulfill({ json: {
            school_id: school.id,
            weekStart: '2026-11-23',
            grades: [1, 2, 3],
            classes: [1, 2],
            stale: url.searchParams.get('refresh') !== '1',
            grid: { 0: { 1: { subject: '수학', changed: true } }, 2: { 3: { subject: grade === '2' ? '물리학' : '과학' } } },
          } });
        }
        if (url.origin === origin && url.pathname === '/api/meal') {
          assert.equal(request.headers().authorization, 'Bearer ' + token);
          assert.equal(url.searchParams.get('school_id'), school.id);
          const date = url.searchParams.get('date')!;
          assert.match(date, /^\d{8}$/);
          mealReads.push(date);
          if (mealState === 'error') return route.fulfill({ status: 503, json: { school_id: school.id, error: 'synthetic error' } });
          return route.fulfill({ json: {
            date, today: date, school_id: school.id,
            meals: mealState === 'empty' ? [] : [{ type: '중식', items: ['현미밥', '두부조림', '과일'], calories: '720 kcal' }],
          } });
        }
        if (url.origin === origin && url.pathname.startsWith('/backend/auth/')) {
          return route.fulfill({
            status: 400,
            headers: { 'x-sb-error-code': 'invalid_credentials' },
            json: { error_code: 'invalid_credentials', msg: 'Synthetic provider rejection' },
          });
        }
        unexpected.push(url.origin + url.pathname);
        return route.abort();
      });
      for (const [route, name] of routes) {
        const response = await page.goto(origin + '/new' + route);
        assert.equal(response?.status(), 200);
        assert.equal(response?.headers()['x-robots-tag'], 'noindex, nofollow');
        await page.locator('main h1').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.locator('img[src="' + contestBanner + '"]').evaluateAll(images =>
          Promise.all(images.map(image => (image as HTMLImageElement).decode())),
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow at ' + width);
        assert.equal(await page.locator('body').getByText(privateMarker).count(), 0);
        assert.ok(!(await page.content()).includes(privateMarker), 'Private fields must not be serialized');
        await page.screenshot({ path: path.join(output, name + '-' + width + '.png'), animations: 'disabled' });
        if (width === 390 || width === 1440) {
          await page.addScriptTag({ content: axe.source });
          const accessibility = await page.evaluate(async () => {
            const runner = (window as Window & { axe: typeof axe }).axe;
            return await runner.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
          });
          assert.deepEqual(accessibility.violations.map(entry => entry.id), [], name + ' accessibility at ' + width);
        }
        const performance = await page.evaluate(() => {
          const { lcp, layoutShift } = (window as Window & { __previewPaint: { lcp: number; layoutShift: number } }).__previewPaint;
          const stylesheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), sheet => new URL(sheet.href).pathname);
          return { lcpMs: Math.round(lcp), observedLayoutShift: layoutShift, stylesheets };
        });
        assert.ok(performance.stylesheets.length && performance.stylesheets.every(url => url.startsWith('/new/_next/')));
        results.push({ view: name, width, height, navigation: width < 768 ? 'dock' : 'sidebar', ...performance });
      }

      if (width === 390 || width === 1440) {
        await page.goto(origin + '/new/docs');
        const guides = await page.locator('main a[href^="/new/docs/"]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).pathname));
        assert.ok(guides.length >= 50);
        for (const href of guides) {
          const response = await page.goto(origin + href);
          assert.equal(response?.status(), 200, href);
          await page.locator('main h1').waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, href);
        }
        results.push({ guideBodiesChecked: guides.length, width, height });
      }

      if (width === 390 || width === 1440) {
        const reduced = width === 390;
        await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
        await page.goto(origin + '/new/contests', { waitUntil: 'networkidle' });
        const card = page.locator('main .pv-list-contests a').filter({ hasText: '교내 연구 발표회' });
        const flight = '.pv-collaboration-contest-flight';
        await card.locator('img').evaluate(image => (image as HTMLImageElement).decode());
        await page.evaluate(selector => {
          let opened = false;
          let animated = false;
          const observer = new MutationObserver(records => {
            opened ||= !!document.querySelector(selector);
            animated ||= records.some(record => {
              if (!(record.target instanceof HTMLElement) || !record.target.matches(selector)) return false;
              const transform = record.target.style.transform;
              return transform !== '' && transform !== 'none';
            });
          });
          observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
          Object.defineProperty(window, '__previewCoverFlight', {
            value: () => { observer.disconnect(); return { opened, animated }; },
            configurable: true,
          });
        }, flight);
        await card.click();
        await page.waitForURL(origin + '/new/contests/' + contestId);
        const cover = page.locator('[data-pv-contest-cover="' + contestId + '"]');
        await cover.locator('img').evaluate(image => (image as HTMLImageElement).decode());
        await page.locator(flight).waitFor({ state: 'hidden' });
        const animation = await page.evaluate(() => (window as Window & {
          __previewCoverFlight: () => { opened: boolean; animated: boolean };
        }).__previewCoverFlight());
        assert.deepEqual(animation, { opened: !reduced, animated: !reduced }, 'Contest cover respects the motion preference');
        assert.equal(await cover.locator('img').getAttribute('src'), contestBanner);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        results.push({ contestCoverTransition: animation.animated, reducedMotion: reduced, width, height });
      }

      if (width === 1440) {
        await page.goto(origin + '/new/timetable');
        const trigger = page.getByRole('button', { name: '빠른 기능 검색' });
        await trigger.focus();
        await page.keyboard.press('Control+k');
        const dialog = page.getByRole('dialog', { name: '빠른 기능 검색' });
        await dialog.getByRole('searchbox').waitFor();
        await page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'search');
        await dialog.getByRole('searchbox').fill('학교');
        await dialog.getByRole('link', { name: '학교', exact: true }).waitFor();
        await page.screenshot({ path: path.join(output, 'quick-search-1440.png'), animations: 'disabled' });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(element => element === document.activeElement, await trigger.elementHandle());
      }

      if (width === 390) {
        await page.goto(origin + '/new');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), '본문으로 건너뛰기');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'preview-content');
        await page.getByRole('searchbox', { name: '기능 검색' }).fill('주피터');
        await page.getByRole('button', { name: '검색', exact: true }).click();
        await page.waitForURL('**/new/services?*');
        await page.getByRole('link', { name: /학교 GPU/ }).waitFor();
        await page.getByRole('navigation', { name: '모바일 탐색' }).getByRole('link', { name: '학교' }).click();
        await page.waitForURL('**/new/schools');
        await page.getByRole('link', { name: '다음' }).click();
        await page.waitForURL('**offset=18');
        await page.getByRole('link', { name: /예시학교 20/ }).waitFor();
        await page.getByRole('searchbox').fill('예시과학고');
        await page.getByRole('button', { name: '검색', exact: true }).click();
        await page.getByRole('link', { name: /예시과학고등학교/ }).click();
        await page.waitForURL('**/new/schools/fixture-school-0');
        await page.getByRole('heading', { name: '예시과학고등학교', exact: true, level: 1 }).waitFor();
        assert.ok(page.url().includes('/new/schools/fixture-school-0'));
        await page.goBack();
        await page.getByRole('searchbox').waitFor();
        assert.equal(await page.getByRole('searchbox').inputValue(), '예시과학고');
        await page.goto(origin + '/new/schools?query=offline-test');
        await page.getByText('목록을 불러오지 못했어요').waitFor();
        await page.getByRole('link', { name: '다시 불러오기' }).waitFor();
        await page.goto(origin + '/new/docs?category=school');
        await page.getByRole('searchbox', { name: '문서 검색' }).fill('급식');
        await page.getByRole('button', { name: '검색', exact: true }).click();
        await page.waitForURL('**/new/docs?*');
        await page.locator('main a[href^="/new/docs/"]').first().waitFor();
        assert.equal(new URL(page.url()).searchParams.get('category'), 'school');
        await page.goto(origin + '/new/docs/school-integration?catalog_school_id=fixture-school-0');
        assert.match(await page.getByRole('link', { name: /선택한 학교로 도입 신청 이어가기/ }).getAttribute('href') || '', /catalog_school_id=fixture-school-0/);
        const contents = page.locator('details.pv-doc-mobile-toc');
        assert.equal(await contents.getAttribute('open'), null);
        await contents.getByText('문서 목차', { exact: true }).click();
        await contents.getByRole('link').first().waitFor();
        await contents.getByRole('link').first().click();
        assert.match(page.url(), /#section-1$/);
        const missing = await page.goto(origin + '/new/schools/absent-school');
        assert.equal(missing?.status(), 404);
        await page.goto(origin + '/new/auth/login');
        await page.getByLabel('이메일').fill('browser-test@example.invalid');
        await page.getByLabel('비밀번호', { exact: true }).fill('synthetic-password');
        await page.getByRole('button', { name: '비밀번호 보기' }).click();
        assert.equal(await page.getByLabel('비밀번호', { exact: true }).getAttribute('type'), 'text');
        await page.getByRole('button', { name: '로그인하기' }).click();
        await page.getByRole('alert').getByText('이메일 또는 비밀번호를 다시 확인해 주세요.').waitFor();
        assert.equal(await page.getByLabel('이메일').inputValue(), 'browser-test@example.invalid');
        assert.ok(!page.url().includes('synthetic-password'));
        assert.equal(mealReads.length, 0);
        await page.goto(origin + '/new/meal?school_id=other-school');
        await page.getByText('로그인하고 학교 급식을 확인해요').waitFor();
        assert.equal(mealReads.length, 0);
        await page.locator('main').getByRole('link', { name: '로그인' }).click();
        await page.getByLabel('이메일').fill(user.email);
        await page.getByLabel('비밀번호', { exact: true }).fill('synthetic-password');
        acceptLogin = true;
        await page.getByRole('button', { name: '로그인하기' }).click();
        await page.waitForURL('**/new/meal');
        await page.getByText('현미밥').waitFor();
        await page.screenshot({ path: path.join(output, 'meal-authenticated-390.png'), animations: 'disabled' });
        mealState = 'empty';
        await page.getByRole('button', { name: '다음 날짜' }).click();
        await page.getByText('이 날짜에 등록된 급식이 없어요').waitFor();
        assert.notEqual(mealReads.at(-1), mealReads[0]);
        mealState = 'error';
        await page.getByRole('button', { name: '이전 날짜' }).click();
        await page.getByText('식단을 불러오지 못했어요').waitFor();
        mealState = 'ready';
        await page.getByRole('button', { name: '다시 불러오기' }).click();
        await page.getByText('현미밥').waitFor();
        await page.goto(origin + '/new/timetable?school_id=untrusted');
        await page.getByRole('group', { name: '요일 선택' }).getByRole('button', { name: /수/ }).click();
        await page.getByText('과학', { exact: true }).filter({ visible: true }).waitFor();
        await page.getByRole('combobox', { name: '학년' }).click();
        await page.getByRole('option', { name: '2학년' }).click();
        await page.getByText('물리학', { exact: true }).filter({ visible: true }).waitFor();
        assert.equal(timetableReads.at(-1), '2');
        const days = page.getByRole('group', { name: '요일 선택' }).getByRole('button');
        const color = (index: number) => days.nth(index).evaluate(element => getComputedStyle(element).backgroundColor);
        assert.notEqual(await color(2), await color(0));
        await page.getByRole('button', { name: '시간표 새로고침' }).click();
        await page.getByText('마지막으로 확인한 시간표예요.', { exact: false }).waitFor({ state: 'hidden' });
        await page.getByText('물리학', { exact: true }).filter({ visible: true }).waitFor();
        await page.screenshot({ path: path.join(output, 'timetable-authenticated-390.png'), animations: 'disabled' });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.getByRole('table', { name: '주간 시간표' }).waitFor();
        await page.screenshot({ path: path.join(output, 'timetable-authenticated-1440.png'), animations: 'disabled' });
        const timetableCount = timetableReads.length;
        await page.setViewportSize({ width, height });
        verifiedSchool = false;
        const count = mealReads.length;
        await page.reload();
        await page.getByText('학교 소속을 확인해 주세요', { exact: true }).waitFor();
        assert.equal(timetableReads.length, timetableCount, 'Unverified school membership must not read timetables');
        await page.goto(origin + '/new/meal');
        await page.getByText('학교 소속을 확인해 주세요', { exact: true }).waitFor();
        assert.equal(mealReads.length, count, 'Unverified school membership must not read meals');
        await page.goto(origin + '/new');
        await page.getByRole('heading', { name: '안녕하세요, 박예시 님' }).waitFor();
        await page.getByRole('link', { name: '내 계정' }).waitFor();
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('Verified ' + results.filter(record => 'view' in record).length + ' rendered route and viewport combinations.');
  console.log('Guide checks: ' + JSON.stringify(results.filter(record => 'guideBodiesChecked' in record)));
} finally {
  app.kill('SIGTERM');
  jsonServer.close();
}
