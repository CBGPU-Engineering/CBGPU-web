/** Synthetic local study fixtures; SDK rejection is injected without sending any write. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const origin = process.env.CBGPU_MATCH_TEST_ORIGIN || 'http://localhost:13980';
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({ headless: true, executablePath: '/tmp/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
 const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
 const session = await fetch(origin + '/backend/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'student@example.invalid', password: 'demo-only' }) }).then(r => r.json());
 await context.addInitScript(s => localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)), session);
 await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
 const page = await context.newPage();
 await page.route('**/api/auth/shared-session', route => route.fulfill({ json: { state: 'active', value: JSON.stringify(session) } }));
 await page.route('**/backend/rest/v1/study_posts**', route => { assert.equal(route.request().method(), 'GET'); return route.fulfill({ json: [] }); });
 await page.route('**/backend/rest/v1/study_members**', route => { assert.equal(route.request().method(), 'GET'); return route.fulfill({ json: [] }); });
 await page.goto(origin + '/match', { waitUntil: 'networkidle' });
 await page.getByRole('button', { name: '만들기', exact: true }).click();
 await page.locator('#match-title').fill('실패해도 남는 제목');
 await page.locator('#match-description').fill('실패해도 남는 설명');
 await page.evaluate(() => {
  const client = window.__cbgpuAuthClient!;
  const original = client.from.bind(client);
  let attempts = 0;
  (window as any).__matchAttempts = () => attempts;
  client.from = ((table: string) => {
   if (table !== 'study_posts') return original(table);
   const query = original(table);
   query.insert = (() => ({ abortSignal: () => { attempts++; return Promise.reject(new Error('Synthetic SDK promise rejection')); } })) as any;
   return query;
  }) as typeof client.from;
 });
 await page.getByRole('button', { name: '스터디 만들기', exact: true }).click();
 await page.getByText('스터디 생성 결과를 확인하지 못했어요.', { exact: false }).waitFor();
 assert.equal(await page.locator('#match-title').inputValue(), '실패해도 남는 제목');
 assert.equal(await page.locator('#match-description').inputValue(), '실패해도 남는 설명');
 assert.equal(await page.locator('[role=dialog]').first().count() > 0, true);
 const create = page.locator('button').filter({ hasText: /^스터디 만들기$/ });
 assert.equal(await create.isEnabled(), true);
 await page.waitForTimeout(700);
 assert.equal(await page.evaluate(() => (window as any).__matchAttempts()), 1);
 console.log('Rejected SDK promise: draft/dialog preserved; submit unlocked; no automatic retry.');
 await context.close();
} finally { await browser.close(); }
