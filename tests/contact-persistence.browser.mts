/** Loopback only: contact requests are intercepted, never sent to email providers. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.CBGPU_CONTACT_TEST_ORIGIN || 'http://localhost:13980';
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const output = '/tmp/cbgpu-contact-persistence'; fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/tmp/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
for (const config of [
 { name: 'desktop-light', width: 1440, height: 1000, colorScheme: 'light' },
 { name: 'desktop-dark', width: 1440, height: 1000, colorScheme: 'dark' },
 { name: 'phone-light', width: 390, height: 844, colorScheme: 'light' },
 { name: 'phone-dark', width: 390, height: 844, colorScheme: 'dark' },
 { name: 'webview', width: 393, height: 851, colorScheme: 'dark' },
]) {
 const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, colorScheme: config.colorScheme as 'light' | 'dark', ...(config.name === 'webview' ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36' } : {}) });
 await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
 const page = await context.newPage();
 let writes = 0, mode = 'success'; let release: (() => void) | undefined;
 await page.route('**/api/contact', async route => {
  writes++;
  if (mode === 'success') await new Promise<void>(resolve => { release = resolve; });
  if (mode === 'html') return route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Unavailable</h1>' });
  return route.fulfill({ json: { ok: true } });
 });
 await page.goto(origin + '/contact', { waitUntil: 'networkidle' });
 await page.locator('#contact-name').fill('합성 문의');
 await page.locator('#contact-email').fill('contact@example.invalid');
 await page.locator('#contact-message').fill('전송한 내용');
 // Same event turn reproduces submission before React can disable the button.
 await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
 await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.textContent?.includes('전송 중'));
 for(let spin=0;!release&&spin<200;spin++) await page.waitForTimeout(25);
 assert.ok(release, await page.locator('body').innerText());
 await page.locator('#contact-message').fill('전송 중 작성한 새 내용');
 release();
 await page.getByRole('button', { name: '문의 보내기', exact: true }).waitFor({ state: 'visible' });
 await page.waitForFunction(() => !(document.querySelector('button[type="submit"]') as HTMLButtonElement)?.disabled);
 assert.equal(writes, 1);
 assert.equal(await page.locator('#contact-message').inputValue(), '전송 중 작성한 새 내용');
 mode = 'html';
 await page.getByRole('button', { name: '문의 보내기', exact: true }).click();
 await page.getByText('문의 전송 결과를 확인하지 못했어요.', { exact: false }).waitFor();
 assert.equal(await page.locator('#contact-message').inputValue(), '전송 중 작성한 새 내용');
 assert.equal(await page.locator('button[type=submit]').isEnabled(), true);
 assert.equal(writes, 2);
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 await page.screenshot({ path: output + '/' + config.name + '.png', fullPage: true });
 await context.close();
 console.log(config.name + ': duplicate submit blocked; concurrent draft preserved; HTML failure recoverable');
}
} finally { await browser.close(); }
