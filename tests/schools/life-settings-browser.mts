/** Local synthetic fixtures; no real source hosts, account grants or runtime configuration. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.CBGPU_SCHOOLS_TEST_ORIGIN || "http://localhost:3243";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CBGPU_CHROMIUM || "/tmp/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const session = await fetch(
    origin + "/backend/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "researcher@example.invalid",
        password: "demo-only",
      }),
    },
  ).then((r) => r.json());
  await context.addInitScript(
    (s) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)),
    session,
  );
  await page.route("**/api/auth/shared-session", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state: "active", value: JSON.stringify(session) }),
    }),
  );
  let platform = false,
    denySave = false;
  await page.route("**/backend/rest/v1/profiles?**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: session.user.id,
        is_admin: platform,
        is_approved: false,
        full_name: "Synthetic operator",
      }),
    }),
  );
  const school = {
    id: "school-a",
    official_name: "Synthetic Academy",
    display_name: "Synthetic Academy",
    region: "Synthetic",
    type: "HIGH_SCHOOL",
    status: "APPROVED",
    brand_color: "#17634d",
    logo_path: null,
    features: ["school_life", "projects"],
    life_capabilities: { timetable: true, meal: false, news: false },
  };
  const membership = {
    id: "member",
    user_id: session.user.id,
    school_id: "school-a",
    membership_type: "TEACHER",
    status: "ACTIVE",
    verified: true,
    school_roles: ["SCHOOL_ADMIN"],
    school,
  };
  let source: any = {
    school_id: school.id,
    school_name: school.official_name,
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
      school_name: school.official_name,
      region: "Synthetic",
    },
  };
  const writes: any[] = [];
  let adminReads = 0;
  await page.route("**/api/schools/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice("/api/schools/".length);
    let data: any = {},
      status = 200;
    if (path === "memberships")
      data = { items: [membership], current_school_id: school.id };
    else if (path === "schools/school-a/configuration")
      data = {
        school,
        configuration: {
          display_name: school.display_name,
          brand_color: school.brand_color,
        },
        features: school.features,
        available_features: school.features,
        revision: 1,
        can_manage_roles: true,
      };
    else if (path === "schools/school-a/members")
      data = { items: [membership] };
    else if (path === "schools/school-a/life-sources") data = source;
    else if (path === "admin/schools/school-a/life-sources") {
      if (request.method() === "PATCH") {
        const payload = request.postDataJSON();
        writes.push(payload);
        if (denySave) {
          status = 403;
          data = { error: "PLATFORM_ADMIN_REQUIRED" };
        } else {
          assert.equal(payload.confirmed, true);
          assert.deepEqual(payload.allowed_hosts, ["school.example.edu"]);
          assert.equal(payload.news_url, "https://school.example.edu/news");
          assert.equal(payload.comcigan_school_name, school.official_name);
          source = {
            ...source,
            news_url: payload.news_url,
            version: source.version + 1,
          };
          data = { ok: true };
        }
      } else {
        adminReads++;
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
  await page.goto(origin + "/schools/school-a/admin?section=integrations", {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Configured sources" }).waitFor();
  assert.equal(
    await page.getByLabel("Reviewed allowed hosts (one per line)").count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Save reviewed source configuration" })
      .count(),
    0,
  );
  assert.equal(adminReads, 0);
  await page.getByRole("link", { name: "Guest access", exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Academic year", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      schoolAdminReadOnly: true,
      sidebarSections: true,
      mobile320: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
