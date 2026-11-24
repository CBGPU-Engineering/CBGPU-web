import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.CBGPU_PREVIEW_ORIGIN || 'http://127.0.0.1:14631';
const endpoint = new URL(origin);
assert.equal(endpoint.hostname, "127.0.0.1");
assert.equal(endpoint.origin, origin);
assert.equal(endpoint.protocol, "http:");
const output = process.env.CBGPU_PREVIEW_OUTPUT || "/tmp/cbgpu-v2-school-ops";
const user = {
  id: '6ea9b795-1c0e-4521-a45b-a8836f19214c', aud: 'authenticated', role: 'authenticated',
  email: 'student-fixture@example.invalid', user_metadata: { full_name: '김예시' }, app_metadata: {},
  created_at: '2026-11-01T00:00:00Z',
};
const profile = { id: user.id, full_name: '김예시', student_id: '2201', is_approved: true };
const school = {
  id: 'cbsh', official_name: '예시과학고등학교', display_name: '예시과학고등학교', type: 'HIGH',
  status: 'APPROVED', features: ['school_life', 'cbsh_eduset', 'cbsh_wakeup', 'clubs'],
  life_capabilities: { timetable: true, meal: true, news: false },
};
const otherSchool = { ...school, id: 'fixture-other', display_name: '다른학교' };
const row = {
  id: 'c5ea6c21-7094-4012-ab6d-8fc06c609c10', uploader_id: user.id, title: '물리 보고서',
  file_name: 'physics.txt', tags: ['과학'], content_type: 'text/plain', size_bytes: 93, created_at: '2026-11-01T00:00:00Z',
};
const uploadBytes = Buffer.from('preview only');
const uploadRecord = '08e184c5-1703-4322-8f9f-97589b26d264';
const second = { ...row, id: 'test-not-owned', uploader_id: 'other-student', title: '국어 참고자료', tags: ['국어'] };
const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({
  sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url'), 'c3ludGhldGlj'].join('.');
const session = { access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user };

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 812 : 900 },
      isMobile: width < 600,
      hasTouch: width < 600,
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
      serviceWorkers: 'block',
    });
    let memberSchool = school;
    let managerRole = '';
    let savedName = profile.full_name;
    let unauthorizedReads = 0;
    const unexpectedMutations: string[] = [];
    let uploaded = false;
    const errors: string[] = [];
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      if (url.origin !== origin) return route.abort();
      if (path.startsWith('/new')) return route.continue();
      if (/^\/brand\/v1\/(symbol|horizontal|wordmark)_(black|white)\.svg$/.test(path)) {
        return route.fulfill({ contentType: 'image/svg+xml', body: await readFile('public' + path) });
      }
      if (path === '/backend/auth/v1/token' && method === 'POST') return route.fulfill({ json: session });
      if (path === '/backend/auth/v1/user') return route.fulfill({ json: user });
      if (path === '/backend/rest/v1/profiles') {
        if (method === 'PATCH') {
          assert.equal(request.headers().authorization, 'Bearer ' + token);
          assert.equal(url.searchParams.get('id'), 'eq.' + user.id);
          assert.deepEqual(request.postDataJSON(), { full_name: '김수정' });
          savedName = '김수정';
          return route.fulfill({ status: 204, body: '' });
        }
        return route.fulfill({ json: { ...profile, full_name: savedName } });
      }
      if (path === '/backend/rest/v1/shared_materials') return route.fulfill({ json:
        url.searchParams.has('id') ? row : [row, second, ...(uploaded ? [{ ...row, id: uploadRecord, title: '검사용 자료' }] : [])] });
      if (path === '/backend/rest/v1/gpu_ssh_keys') return route.fulfill({ json: null });
      if (path === '/backend/rest/v1/study_supervisors') return route.fulfill({ json: {
        duty_date: day(), duties: [{ type: '교내 자습', teacher: '예시' }],
      } });
      if (path === '/backend/rest/v1/wakeup_playlists') return route.fulfill({ body: 'null', contentType: 'application/json' });
      if (path === '/backend/rest/v1/rpc/laser_queue_length' && method === 'POST') {
        assert.equal(request.headers().authorization, 'Bearer ' + token);
        return route.fulfill({ json: 0 });
      }
      if (path.startsWith('/backend/rest/v1/') && method === 'GET') return route.fulfill({ json: [] });
      if (path === '/api/schools/memberships') return route.fulfill({ json: {
        current_school_id: memberSchool.id,
        items: [{ id: 'fixture-membership', user_id: user.id, school_id: memberSchool.id, membership_type: 'STUDENT',
          status: 'ACTIVE', verified: true, school: memberSchool, student_number: '2201', school_roles: managerRole ? [managerRole] : ['STUDENT'] }],
      } });
      if (path === '/api/schools/resource-contexts') return route.fulfill({ json: {
        current_school_id: memberSchool.id,
        items: [{ type: 'MEMBERSHIP', school_id: memberSchool.id, school: memberSchool, membership_id: 'fixture-membership',
          expires_at: null, can_administer: Boolean(managerRole), resources: ['study', 'school_storage'] }],
        server_time: new Date().toISOString(),
      } });
      if (path === '/api/schools/schools/' + memberSchool.id + '/resource-access') return route.fulfill({ json: {
        school_id: memberSchool.id, expires_at: null, context_type: 'MEMBERSHIP', legacy_cbsh_access: false,
        resources: { gpu: false, ai: false, study: memberSchool.id === school.id, school_storage: true,
          fabrication: false, school_compute: false, contests: false, central_cpu: false },
        reasons: {}, server_time: new Date().toISOString(),
      } });
      if (path.startsWith('/api/schools/schools/') && path.endsWith('/configuration')) {
        if (managerRole === 'SCHOOL_ADMIN' && path === '/api/schools/schools/' + memberSchool.id + '/configuration') {
          assert.equal(request.headers().authorization, 'Bearer ' + token);
          return route.fulfill({ json: { school: memberSchool, features: memberSchool.features, revision: 1, can_manage_roles: true } });
        }
        unauthorizedReads++;
        return route.fulfill({ status: 403, json: { message: 'Not allowed' } });
      }
      if (path === '/api/schools/schools/' + memberSchool.id + '/clubs') {
        assert.equal(request.headers().authorization, 'Bearer ' + token);
        return route.fulfill({ json: { school_id: memberSchool.id, server_now: new Date().toISOString(),
          items: [], campaigns: [], can_manage_campaigns: false, total: 0 } });
      }
      if (path === '/api/study/student' && method === 'GET') {
        return route.fulfill({ status: 409, json: { code: 'school_connection_required' } });
      }
      if (path.startsWith('/api/study/proxy/')) {
        assert.equal(memberSchool.id, school.id);
        assert.equal(request.headers()['x-cbgpu-auth'], 'Bearer ' + token);
        if (path.endsWith('/students')) return route.fulfill({ json: [] });
        if (path.endsWith('/rooms')) return route.fulfill({ json: [{ id: 1, width: 10, height: 12, name: '별관 자습실', hasSeats: true }] });
        if (path.endsWith('/composition')) return route.fulfill({ json: { seats: [{ id: 5, x: 5, y: 8, name: '5' }], obstacles: [] } });
        if (path.endsWith('/selfstudy/search')) return route.fulfill({ json: [] });
        if (path.endsWith('/policies/selfstudy')) return route.fulfill({ json: { data: {
          timetable: { presets: { test: [{}, {}, {}] }, assign: {}, exception: { [day()]: 'test' } },
        } } });
      }
      if (path === '/api/wakeup/spotify/search') return route.fulfill({ json: { items: [
        { id: 'fixture-track', uri: 'spotify:track:fixture', title: '테스트 노래', artists: '테스트 팀', thumbnailUrl: null, spotifyUrl: 'https://open.spotify.com/track/fixture' },
      ] } });
      if (path === '/api/files/materials/quota') return route.fulfill({ json: { remaining_bytes: 1024 * 1024 } });
      if (path === '/api/files/materials' && method === 'POST') {
        assert.equal(request.headers().authorization, 'Bearer ' + token);
        assert.equal(request.headers()['x-cbgpu-school-id'], school.id);
        const upload = request.postDataJSON();
        assert.equal(upload.title, '검사용 자료');
        assert.equal(upload.file_name, 'local-fixture.txt');
        assert.equal(upload.size_bytes, uploadBytes.length);
        return route.fulfill({ json: { id: uploadRecord, school_id: school.id, access_scope: 'SCHOOL' } });
      }
      if (path === '/api/files/materials/' + uploadRecord + '/upload') {
        assert.equal(request.headers().authorization, 'Bearer ' + token);
        return route.fulfill({ json: { offset: uploaded ? uploadBytes.length : 0, size_bytes: uploadBytes.length, complete: uploaded } });
      }
      if (path === '/api/files/materials/' + uploadRecord + '/chunks' && method === 'PUT') {
        assert.equal(url.searchParams.get('offset'), '0');
        assert.equal(request.headers().authorization, 'Bearer ' + token);
        assert.deepEqual(request.postDataBuffer(), uploadBytes);
        uploaded = true;
        return route.fulfill({ json: { offset: uploadBytes.length, complete: true } });
      }
      if (path === '/api/files/materials/' + row.id + '/content') {
        assert.equal(request.headers().authorization, 'Bearer ' + token);
        return route.fulfill({ contentType: 'text/plain', body: 'local synthetic material fixture' });
      }
      if (path.startsWith('/portal/') || path === '/api/auth/shared-session') return route.fulfill({ status: 404, json: {} });
      if (method !== 'GET') unexpectedMutations.push(method + ' ' + path);
      return route.fulfill({ status: 404, json: {} });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const visit = (path: string) => page.goto(origin + '/new' + path);
    async function screenshot(name: string) {
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' exceeds viewport');
      await page.screenshot({ path: output + '/' + name + '-' + width + '.png', animations: 'disabled' });
    }
    await visit('/materials');
    await page.getByRole('link', { name: '로그인', exact: true }).last().click();
    await page.getByRole('textbox', { name: '이메일' }).fill(user.email);
    await page.locator('input[type=password]').fill('synthetic-local-fixture');
    await page.getByRole('button', { name: '로그인하기', exact: true }).click();
    await page.getByRole('link', { name: row.title }).waitFor();
    assert.match(page.url(), /\/new\/materials$/);
    await screenshot('materials');
    await page.getByRole('searchbox', { name: '자료 검색' }).fill('국어');
    await page.getByRole('link', { name: second.title }).waitFor();
    await page.getByRole('link', { name: row.title }).waitFor({ state: 'hidden' });
    await page.getByRole('searchbox', { name: '자료 검색' }).clear();
    await page.getByRole('button', { name: '내가 올린 자료' }).click();
    await page.getByRole('link', { name: second.title }).waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: row.title }).click();
    await page.getByRole('heading', { name: row.title }).waitFor();
    const filePromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '다운로드' }).click();
    assert.equal((await filePromise).suggestedFilename(), row.file_name);
    await screenshot('material-detail');

    await visit('/materials/new');
    await page.getByText('선택한 학교에 자료를 공유해요.').waitFor();
    await page.getByRole('textbox', { name: '제목' }).fill('검사용 자료');
    await page.locator('input[type=file]').setInputFiles({ name: 'local-fixture.txt', mimeType: 'text/plain', buffer: uploadBytes });
    const uploadButton = page.getByRole('button', { name: '자료 공유하기', exact: true });
    await screenshot('upload');
    await uploadButton.click();
    await page.getByRole('link', { name: '검사용 자료' }).waitFor();
    assert.equal(uploaded, true);

    await visit('/profile');
    await page.getByText('학번 2201').waitFor();
    await screenshot('profile');
    await page.getByRole('textbox', { name: '이름', exact: true }).fill('김수정');
    await page.getByRole('button', { name: '프로필 저장' }).click();
    await page.getByText('프로필을 저장했어요.').waitFor();
    assert.equal(savedName, '김수정');
    await page.getByRole('button', { name: '계정 삭제', exact: true }).click();
    const deletion = page.getByRole('dialog', { name: '계정을 삭제할까요?' });
    await deletion.waitFor();
    await page.keyboard.press('Escape');
    await deletion.waitFor({ state: 'hidden' });

    await visit('/study');
    const room = page.getByRole('button', { name: /별관 자습실/ });
    await room.waitFor();
    await screenshot('study');
    await room.click();
    const close = page.getByRole('button', { name: '좌석 창 닫기' });
    await close.waitFor();
    const bounds = await close.boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize()!.height);
    await screenshot('study-room');
    await page.getByRole('dialog', { name: /별관 자습실/ }).getByRole('button', { name: '목록', exact: true }).click();
    await page.getByRole('dialog', { name: /별관 자습실/ }).getByRole('button', { name: /5번/ }).click();
    await page.getByRole('button', { name: '5번 자리 신청', exact: true }).waitFor();
    await close.click();
    await close.waitFor({ state: 'hidden' });

    await visit('/wakeup');
    await page.getByRole('searchbox', { name: 'Spotify 노래 검색' }).fill('테스트');
    await page.getByRole('button', { name: '테스트 노래 선택' }).click();
    await page.getByRole('button', { name: '다시 고르기' }).waitFor();
    await screenshot('wakeup');

    await visit('/schools/fixture-other/admin');
    await page.getByText('이 학교의 관리 권한이 없어요').waitFor();
    assert.equal(unauthorizedReads, 0);
    managerRole = 'SCHOOL_ADMIN';
    await visit('/school-admin');
    await page.getByRole('link', { name: school.display_name }).waitFor();
    await screenshot('school-admin');
    await page.getByRole('link', { name: school.display_name }).click();
    await page.getByText('설정된 기능').waitFor();
    await screenshot('school-management');
    managerRole = 'GPU_ADMIN';
    await visit('/schools/' + school.id + '/admin?section=features');
    await page.getByText('이 관리 항목에 접근할 수 없어요').waitFor();
    assert.equal(unauthorizedReads, 0);

    await visit('/clubs');
    await page.getByText(/학교가 모집 일정을 정하면/).waitFor();
    await screenshot('clubs');
    await visit('/manufacturing/laser');
    await page.getByRole('button', { name: '신청하기' }).last().waitFor();
    await screenshot('fabrication');

    memberSchool = otherSchool;
    await visit('/study');
    await page.getByText('이 학교의 자습 신청을 이용할 수 없어요').waitFor();
    assert.deepEqual(unexpectedMutations, []);
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write('School flows passed at ' + width + 'px\n');
  }
} finally {
  await browser.close();
}
