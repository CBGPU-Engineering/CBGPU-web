/** Isolated admin-host and portal fixtures; DNS is pinned to loopback; HTTP development fixture bypasses CSP upgrade only, no operating login/configuration. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin =
  process.env.CBGPU_PLATFORM_SOURCES_TEST_ORIGIN ||
  "http://admin.cbgpu.com:3244";
assert.match(origin, /^http:\/\/admin\.cbgpu\.com:\d+$/);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CBGPU_CHROMIUM || "/tmp/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-proxy-server",
    "--host-resolver-rules=MAP admin.cbgpu.com 127.0.0.1",
  ],
});
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      bypassCSP: true,
    }),
    page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const owner = "00000000-0000-4000-8000-000000000102",
    sid = "00000000-0000-4000-8000-000000000112";
  const claims = {
    sub: owner,
    session_id: sid,
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: "authenticated",
    aud: "authenticated",
  };
  const session = {
    access_token:
      "e30." +
      Buffer.from(JSON.stringify(claims)).toString("base64url") +
      ".synthetic",
    refresh_token: "synthetic-refresh",
    expires_at: claims.exp,
    token_type: "bearer",
    user: {
      id: owner,
      email: "operator@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Synthetic operator" },
      created_at: new Date().toISOString(),
    },
  };
  await context.addInitScript(
    (s) => localStorage.setItem("sb-admin-auth-token", JSON.stringify(s)),
    session,
  );
  await page.route("**/portal/session", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user_id: owner,
        auth_session_id: sid,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        csrf_token: "synthetic-csrf",
      }),
    }),
  );
  await page.route("**/backend/auth/v1/user", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify(session.user),
    }),
  );
  await page.route("**/backend/rest/v1/profiles?**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: owner,
        is_admin: true,
        is_approved: true,
        full_name: "Synthetic operator",
      }),
    }),
  );
  await page.route("**/backend/rest/v1/printer_managers?**", (r) =>
    r.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.route("https://**", (r) => r.abort());
  let source: any = {
    school_id: "school-a",
    school_name: "Synthetic Academy",
    region: "Synthetic",
    status: "READY",
    version: 1,
    homepage_url: "https://school.example.edu",
    news_url: null,
    letter_url: null,
    calendar_url: null,
    meal_url: null,
    allowed_hosts: ["school.example.edu"],
    meal_provider: null,
    comcigan: {
      status: "LOOKUP_REQUIRED",
      school_code: null,
      school_name: "Synthetic Academy",
      region: "Synthetic",
    },
  };
  let denySave: false | "conflict" | "role" = false,
    reads = 0;
  const writes: any[] = [];
  await page.route("**/api/schools/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice("/api/schools/".length);
    let data: any = {},
      status = 200;
    if (path === "memberships") data = { items: [], current_school_id: null };
    else if (path === "admin/schools/school-a/life-sources") {
      if (request.method() === "PATCH") {
        const payload = request.postDataJSON();
        writes.push(payload);
        if (denySave) {
          status = denySave === "conflict" ? 409 : 403;
          data = {
            error:
              denySave === "conflict"
                ? "SOURCE_VERSION_CONFLICT"
                : "PLATFORM_ADMIN_REQUIRED",
            code:
              denySave === "conflict"
                ? "SOURCE_VERSION_CONFLICT"
                : "PLATFORM_ADMIN_REQUIRED",
          };
        } else {
          assert.equal(payload.confirmed, true);
          assert.equal(payload.expected_version, source.version);
          assert.deepEqual(payload.allowed_hosts, ["school.example.edu"]);
          assert.equal(payload.news_url, "https://school.example.edu/news");
          assert.equal(payload.comcigan_school_name, "Synthetic Academy");
          source = {
            ...source,
            news_url: payload.news_url,
            version: source.version + 1,
          };
          data = { ok: true };
        }
      } else {
        reads++;
        data = source;
      }
    } else {
      status = 403;
      data = { error: "Current platform permission denied for this school" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto(origin + "/admin/schools/school-a/life-sources", {
    waitUntil: "networkidle",
  });
  await page
    .getByLabel("Reviewed allowed hosts (one per line)")
    .waitFor()
    .catch(async (e) => {
      console.log(await page.locator("body").innerText());
      throw e;
    });
  assert.ok(reads > 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Save reviewed source configuration" })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("School news URL (optional)")
    .fill("https://school.example.edu/news");
  await page
    .getByRole("checkbox", { name: /I independently verified/ })
    .check();
  assert.equal(writes.length, 0);
  await page
    .getByRole("button", { name: "Save reviewed source configuration" })
    .click();
  await page
    .getByText("Reviewed sources saved for this school.", { exact: false })
    .waitFor();
  assert.equal(writes.length, 1);
  assert.equal(
    await page
      .getByRole("button", { name: "Save reviewed source configuration" })
      .isDisabled(),
    true,
  );
  denySave = "conflict";
  await page
    .getByLabel("School news URL (optional)")
    .fill("https://school.example.edu/unsaved");
  await page
    .getByRole("checkbox", { name: /I independently verified/ })
    .check();
  await page
    .getByRole("button", { name: "Save reviewed source configuration" })
    .click();
  await page.getByText(/Another review changed these sources/).waitFor();
  assert.equal(
    await page.getByLabel("School news URL (optional)").inputValue(),
    "https://school.example.edu/unsaved",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Save reviewed source configuration" })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Reload latest (discard unsaved edits)" })
    .click();
  await page.getByLabel("School news URL (optional)").waitFor();
  assert.equal(
    await page.getByLabel("School news URL (optional)").inputValue(),
    "https://school.example.edu/news",
  );
  denySave = "role";
  await page
    .getByRole("checkbox", { name: /I independently verified/ })
    .check();
  await page
    .getByRole("button", { name: "Save reviewed source configuration" })
    .click();
  await page.getByText("PLATFORM_ADMIN_REQUIRED", { exact: true }).waitFor();
  assert.equal(writes.length, 3);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  assert.equal(await page.getByRole('button',{name:'Save reviewed source configuration'}).evaluate(element=>element.scrollWidth<=element.clientWidth+1),true);
  assert.equal(await page.getByText('Reviewed sources saved for this school.',{exact:false}).count(),0);
  await page.screenshot({
    path: "/tmp/cbgpu-school-sources-mobile.png",
    fullPage: true,
  });
  await page.goto(origin + "/admin/schools/school-b/life-sources", {
    waitUntil: "networkidle",
  });
  await page
    .getByText("Current platform permission denied for this school", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Save reviewed source configuration" })
      .count(),
    0,
  );
  assert.equal(writes.length, 3);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      realAdminHost: true,
      portalSessionBound: true,
      platformExplicitAdminReadWithoutMembership: true,
      reviewConfirmation: true,
      staleEditsPreservedUntilReload: true,
      serverRoleRevocationDenied: true,
      foreignSchoolNoEditor: true,
      mobile320: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
