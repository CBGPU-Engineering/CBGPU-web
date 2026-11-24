import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.CBGPU_PREVIEW_ORIGIN || 'http://127.0.0.1:14631';
const endpoint = new URL(origin);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.origin, origin);
assert.equal(endpoint.protocol, 'http:');
const output = process.env.CBGPU_PREVIEW_OUTPUT || '/tmp/cbgpu-v2-auth';
const email = 'preview-registration@example.invalid';
const password = 'synthetic-local-fixture';
const destination = '/new/contests?filter=open';
const school = { id: 'cbsh', status: 'APPROVED', display_name: '예시과학고등학교', region: '충청북도',
  allowed_membership_types: ['STUDENT', 'TEACHER', 'EXTERNAL'] };
const otherSchool = { id: 'fixture-middle', status: 'APPROVED', display_name: '예시중학교', region: '충청북도',
  allowed_membership_types: ['STUDENT', 'TEACHER'] };

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      isMobile: width === 390,
      hasTouch: width === 390,
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
      serviceWorkers: 'block',
    });
    const callbacks: URL[] = [];
    const metadata: object[] = [];
    const recoveries: URL[] = [];
    const now = new Date().toISOString();
    const errors: string[] = [];
    let rejectRecovery = false;
    let unexpectedAuthWrites = 0;

    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/new/')) return route.continue();
      if (/^\/brand\/v1\/(symbol|horizontal|wordmark)_(black|white)\.svg$/.test(url.pathname)) {
        return route.fulfill({ contentType: 'image/svg+xml', body: await readFile('public' + url.pathname) });
      }
      if (url.pathname === '/api/schools/schools') {
        assert.equal(request.method(), 'GET');
        const query = url.searchParams.get('q') || '';
        const items = [school, otherSchool].filter(school => school.display_name.includes(query));
        return route.fulfill({ json: { items, total: items.length } });
      }
      if (url.pathname === '/backend/auth/v1/signup') {
        assert.equal(request.method(), 'POST');
        callbacks.push(new URL(url.searchParams.get('redirect_to')!));
        const payload = request.postDataJSON();
        assert.equal(payload.email, email);
        assert.equal(payload.password, password);
        assert.ok(payload.code_challenge);
        metadata.push(payload.data);
        return route.fulfill({ json: { id: '588175dd-7cc2-4588-bba0-70c38c7f6d28', role: 'authenticated',
          aud: 'authenticated', email, created_at: now, user_metadata: {}, app_metadata: {} } });
      }
      if (url.pathname === '/backend/auth/v1/recover') {
        assert.equal(request.method(), 'POST');
        recoveries.push(new URL(url.searchParams.get('redirect_to')!));
        assert.equal(request.postDataJSON().email, email);
        assert.ok(request.postDataJSON().code_challenge);
        return rejectRecovery
          ? route.fulfill({ status: 500, headers: { 'x-sb-error-code': 'unexpected_failure' }, json: { msg: 'Synthetic email service failure' } })
          : route.fulfill({ json: {} });
      }
      if (url.pathname === '/api/auth/shared-session' || url.pathname.startsWith('/portal/')) {
        return route.fulfill({ status: 404, json: {} });
      }
      if (url.pathname.startsWith('/backend/auth/v1/') && request.method() !== 'GET') unexpectedAuthWrites++;
      return route.fulfill({ status: 404, json: {} });
    });

    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const visit = (path: string, next = destination) => page.goto(origin + '/new/auth/' + path + '?next=' + encodeURIComponent(next));
    const photo = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Viewport overflow: ' + name);
      await page.screenshot({ path: output + '/' + name + '-' + width + '.png', animations: 'disabled' });
    };
    const credentials = async () => {
      await page.getByRole('textbox', { name: '이름', exact: true }).fill('가입 예시');
      await page.getByRole('textbox', { name: '이메일', exact: true }).fill(email);
      await page.locator('input[type=password]').fill(password);
    };

    await visit('login');
    await page.getByRole('link', { name: '계정 만들기' }).click();
    await page.getByRole('button', { name: '학교 선택' }).waitFor();
    await page.getByText(school.display_name, { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('next'), destination);
    await photo('signup');
    await page.getByRole('button', { name: '학교 선택' }).click();
    const chooser = page.getByRole('dialog', { name: '어느 학교에서 사용하나요?' });
    await chooser.getByRole('searchbox').fill('중학교');
    await chooser.getByRole('button', { name: /예시중학교/ }).click();
    await page.getByRole('combobox', { name: '소속 유형' }).click();
    await page.getByRole('option', { name: '교사', exact: true }).click();
    await page.getByRole('textbox', { name: /담당 교과 또는 부서/ }).fill('수학');
    await credentials();
    await page.getByRole('button', { name: '비밀번호 보기' }).click();
    assert.equal(await page.locator('input[name=password]').getAttribute('type'), 'text');
    await page.getByRole('button', { name: '계정 만들기', exact: true }).click();
    await page.getByRole('heading', { name: '이메일에서 가입을 확인해 주세요' }).waitFor();
    assert.deepEqual(metadata[0], { full_name: '가입 예시', account_type_request: 'EXTERNAL',
      school_join_request: { school_id: otherSchool.id, type: 'TEACHER', department: '수학' } });
    assert.equal(callbacks[0].pathname, '/auth/callback');
    assert.equal(callbacks[0].searchParams.get('next'), destination);
    await photo('signup-sent');

    await visit('signup');
    await page.getByRole('radio', { name: '학교 소속 없이 시작하기' }).check();
    await credentials();
    await page.getByRole('button', { name: '계정 만들기', exact: true }).click();
    await page.getByRole('heading', { name: '이메일에서 가입을 확인해 주세요' }).waitFor();
    assert.deepEqual(metadata[1], { full_name: '가입 예시', account_type_request: 'EXTERNAL' });

    await visit('signup');
    await page.getByRole('radio', { name: '우리 학교에 도입하기' }).check();
    await credentials();
    await page.getByRole('button', { name: '계정 만들고 도입 신청' }).click();
    await page.getByRole('heading', { name: '이메일에서 가입을 확인해 주세요' }).waitFor();
    assert.deepEqual(metadata[2], { full_name: '가입 예시', account_type_request: 'EXTERNAL', school_setup_request: true });
    assert.equal(callbacks[2].searchParams.get('next'), '/schools/new');

    await visit('signup');
    await page.getByText(school.display_name, { exact: true }).waitFor();
    await credentials();
    await page.getByRole('textbox', { name: '학번', exact: true }).fill('9011');
    await page.getByRole('button', { name: '계정 만들기', exact: true }).click();
    await page.getByRole('alert').getByText('충북과학고 학번 4자리를 확인해 주세요.').waitFor();
    assert.equal(metadata.length, 3);
    await page.getByRole('textbox', { name: '학번', exact: true }).fill('2111');
    await page.getByRole('button', { name: '계정 만들기', exact: true }).click();
    await page.getByRole('heading', { name: '이메일에서 가입을 확인해 주세요' }).waitFor();
    assert.deepEqual(metadata[3], { full_name: '가입 예시', student_id: '2111' });

    await visit('login');
    await page.getByRole('link', { name: '비밀번호 찾기' }).click();
    await page.getByRole('heading', { name: '비밀번호 찾기', exact: true }).waitFor();
    await page.getByRole('textbox', { name: '이메일', exact: true }).fill(email);
    await photo('recovery');
    rejectRecovery = true;
    await page.getByRole('button', { name: '재설정 링크 받기' }).click();
    await page.getByRole('alert').getByText(/메일을 요청하지 못했어요/).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '이메일', exact: true }).inputValue(), email);

    rejectRecovery = false;
    await page.getByRole('button', { name: '재설정 링크 받기' }).click();
    await page.getByRole('heading', { name: '받은편지함을 확인해 주세요' }).waitFor();
    assert.equal(recoveries[1].pathname, '/auth/reset-password');
    assert.equal(recoveries[1].searchParams.get('next'), destination);
    await photo('recovery-sent');
    await page.getByRole('link', { name: '로그인하기' }).click();
    await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('next'), destination);

    await visit('forgot-password', '//external.invalid');
    await page.getByRole('textbox', { name: '이메일', exact: true }).fill(email);
    await page.getByRole('button', { name: '재설정 링크 받기' }).click();
    await page.getByRole('heading', { name: '받은편지함을 확인해 주세요' }).waitFor();
    assert.equal(recoveries[2].origin, origin);
    assert.equal(recoveries[2].searchParams.get('next'), '/new/');

    await visit('reset-password');
    await page.getByRole('link', { name: '재설정 링크 받기' }).waitFor();
    assert.equal(await page.locator('input[type=password]').count(), 0);
    assert.equal(unexpectedAuthWrites, 0);
    assert.deepEqual(errors, []);
    await photo('reset-entry');
    await context.close();
    process.stdout.write('Preview auth flows passed at ' + width + 'px\n');
  }
} finally {
  await browser.close();
}
