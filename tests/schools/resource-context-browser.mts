/** Synthetic production-mode fixture only; no actual school, reservation, AI job or membership is changed. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin =
  process.env.CBGPU_RESOURCE_CONTEXT_TEST_ORIGIN || "http://localhost:3246";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CBGPU_CHROMIUM || "/tmp/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders:{"x-cbgpu-public-host":"researcher.cbgpu.com"},
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
  await page.route("**/backend/rest/v1/profiles?**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: session.user.id,
        is_approved: false,
        is_admin: false,
        full_name: "External collaborator",
      }),
    }),
  );
  // Owned deployment reads are independent of guest school grants. Keep the
  // fixture self-contained instead of contacting an operating deployment worker.
  for (const path of ['/api/deploy/projects','/api/deploy/servers/projects']) {
    await page.route('**'+path, route => {
      assert.equal(route.request().method(), 'GET');
      assert.equal(route.request().headers().authorization, 'Bearer '+session.access_token);
      return route.fulfill({contentType:'application/json',body:'{"projects":[]}'});
    });
  }
  let allowed = true,
    aiEnabled = true,
    current = "cbsh",
    expiresA = Date.now() + 90_000,
    expiresB = Date.now() + 90_000,
    reservations = 0,
    aiWrites = 0,
    membershipWrites = 0,
    gpuReads = 0;
  let continuedB=false,continuationUntil=Date.now()+90_000,otherProofReads=0;
  const bExpiry=()=>expiresB>Date.now()?expiresB:continuedB?continuationUntil:expiresB;
  const selected: string[] = [];
  const school = (id: string) => ({
    id,
    official_name: id === "cbsh" ? "Synthetic CBsh" : "Synthetic Other School",
    display_name: id === "cbsh" ? "Synthetic CBsh" : "Synthetic Other School",
    type: "HIGH_SCHOOL",
    region: "Synthetic",
    features: ["gpu_compute", "school_life", "projects", "contests"],
    ads_enabled: false,
    life_capabilities: { timetable: true, meal: true, news: true },
  });
  const contexts = () => ({
    items: [
      ...(allowed && expiresA > Date.now()
        ? [
            {
              school_id: "cbsh",
              school: school("cbsh"),
              type: "GUEST",
              resources: aiEnabled ? ["gpu", "ai"] : ["gpu"],
              expires_at: new Date(expiresA).toISOString(),
              can_administer: false,
            },
          ]
        : []),
      ...(bExpiry() > Date.now()
        ? [
            {
              school_id: "other-school",
              school: school("other-school"),
              type: "GUEST",
              resources: ["contests"],
              expires_at: new Date(bExpiry()).toISOString(),
              can_administer: false,
            },
          ]
        : []),
    ],
    current_school_id:
      (current === "cbsh" && allowed && expiresA > Date.now()) ||
      (current === "other-school" && bExpiry() > Date.now())
        ? current
        : null,
    server_time: new Date().toISOString(),
  });
  const proof = (id: string) => ({
    school_id: id,
    legacy_cbsh_access: false,
    context_type: "GUEST",
    expires_at: new Date(id === "cbsh" ? expiresA : bExpiry()).toISOString(),
    server_time: new Date().toISOString(),
    resources: {
      gpu: id === "cbsh" && allowed,
      ai: id === "cbsh" && allowed && aiEnabled,
      study: false,
      school_storage: false,
      fabrication: false,
      school_compute: false,
      contests: id === "other-school",
    },
    reasons: {
      gpu: id === "cbsh" ? "ALLOWED" : "NOT_CONFIGURED",
      ai: aiEnabled ? "ALLOWED" : "FEATURE_DISABLED",
      study: "NOT_GRANTED",
    },
  });
  let delay = false,
    release: () => void = () => {},
    signal: () => void = () => {};
  let started: Promise<void>;
  await page.route("**/api/schools/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice("/api/schools/".length);
    let data: any = {},
      status = 200;
    if (path === "memberships")
      data = { items: [], current_school_id: current };
    else if (path === "resource-contexts") data = contexts();
    else if (path === "current-school") {
      const id = request.postDataJSON().school_id;
      assert.ok(contexts().items.some((item) => item.school_id === id));
      selected.push(id);
      current = id;
      data = { ok: true, current_school_id: id };
    } else if (/^schools\/(cbsh|other-school)\/resource-access$/.test(path)) {
      if(path.includes("other-school"))otherProofReads++;
      data = proof(path.split("/")[1]);
      if (delay && path.includes("/cbsh/")) {
        delay = false;
        signal();
        await new Promise<void>((resolve) => (release = resolve));
      }
    } else {
      if (request.method() !== "GET") membershipWrites++;
      status = 403;
      data = { error: "Unexpected scoped endpoint" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.route("**/backend/rest/v1/rpc/get_gpu_booking_schedule", (r) => {
    gpuReads++;
    return r.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("**/backend/rest/v1/reservations**", (r) => {
    if (r.request().method() === "POST") {
      reservations++;
      assert.equal(r.request().postDataJSON().user_id, session.user.id);
      assert.equal(r.request().postDataJSON().gpu_id, 1);
    }
    return r.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("**/backend/rest/v1/research_notes?**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        new URL(r.request().url()).searchParams.has("is_shared")
          ? []
          : [
              {
                id: "preserved-note",
                user_id: session.user.id,
                title: "Preserved own note",
                content: "Synthetic private note",
                tags: [],
                is_shared: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
      ),
    }),
  );
  await page.route("**/api/ai/site-ask", (r) => {
    aiWrites++;
    return r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        chat: {
          id: "synthetic-chat",
          messages: [
            {
              id: "answer",
              role: "assistant",
              content: "Synthetic owned records answer.",
              state: "succeeded",
            },
          ],
        },
        checked_at: new Date().toISOString(),
      }),
    });
  });
  await page.goto(origin + "/workspace?mode=researcher", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", {
      name: /학교 바꾸기 · Synthetic CBsh · 임시 자원 이용/,
    })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "자습 신청", exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByText("학번 또는 이름 확인이 필요해 일부 기능이 제한됩니다.", {
        exact: true,
      })
      .count(),
    0,
  );
  await page.getByLabel("CBGPU 정보 질문").fill("My own records");
  started = new Promise<void>((resolve) => (signal = resolve));
  delay = true;
  await page.getByRole("button", { name: "CBGPU에 질문하기", exact: true }).click();
  await started;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(300);
  release();
  await page
    .getByText("Synthetic owned records answer.", { exact: true })
    .waitFor();
  assert.equal(aiWrites, 1);
  await page.goto(origin + "/dashboard?mode=researcher", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: "예약 신청하기", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "예약 신청하기", exact: true })
      .isDisabled(),
    false,
  );
  await page
    .getByRole("button", { name: "예약 신청하기", exact: true })
    .click();
  await page.getByRole("heading", { name: "예약 신청을 보냈어요" }).waitFor();
  assert.equal(reservations, 1);
  allowed = false;
  await page
    .getByRole("button", { name: "예약 신청하기", exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button',{name:'확인',exact:true}).click();
  await page
    .getByRole("heading", { name: "이용할 학교 또는 임시 자원을 선택해주세요" })
    .waitFor();
  assert.equal(reservations, 1);
  allowed = true;
  aiEnabled = false;
  await page.goto(origin + "/workspace?mode=researcher", {
    waitUntil: "networkidle",
  });
  await page
    .getByText("이 학교에서 현재 해당 기능을 제공하지 않아요.", { exact: true })
    .waitFor();
  assert.equal(await page.getByLabel("CBGPU 정보 질문").isDisabled(), true);
  await page.goto(origin + "/dashboard?mode=researcher", {
    waitUntil: "networkidle",
  });
  assert.equal(
    await page
      .getByRole("button", { name: "예약 신청하기", exact: true })
      .isDisabled(),
    false,
  );
  aiEnabled = true;
  started = new Promise<void>((resolve) => (signal = resolve));
  delay = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await started;
  await page.getByRole("button", { name: "메뉴 열기", exact:true }).click();
  await page.getByRole("button", { name: /학교 바꾸기/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Synthetic Other School/ })
    .click();
  await page
    .getByRole("button", {
      name: /학교 바꾸기 · Synthetic Other School · 임시 자원 이용/,
    })
    .waitFor();
  await page.getByRole("button",{name:"메뉴 닫기",exact:true}).click();
  const before = gpuReads;
  release();
  await page.waitForTimeout(300);
  assert.equal(gpuReads, before);
  assert.equal(
    await page
      .getByRole("button", { name: "예약 신청하기", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(selected, ["other-school"]);
  continuedB=true;expiresB=Date.now()+1000;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(200);
  const beforeDeadline=otherProofReads;
  await page.waitForTimeout(1500);
  assert.ok(otherProofReads>beforeDeadline,'earliest grant expiry triggers a fresh permission read');
  await page.getByRole('button',{name:/학교 바꾸기 · Synthetic Other School · 임시 자원 이용/}).waitFor();
  continuedB=false;
  expiresB = Date.now() + 1500;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("button", { name: "학교 바꾸기 · 학교 선택", exact: true })
    .waitFor({ timeout: 6000 });
  await page.goto(origin + "/notes?mode=researcher", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", { name: "Preserved own note", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "새 노트", exact: true })
      .isDisabled(),
    false,
  );
  assert.equal(membershipWrites, 0);
  assert.equal(reservations, 1);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/cbgpu-resource-context-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      guestDistinctNoFakeMembership: true,
      unapprovedIdentityCanUseApprovedResource: true,
      freshRevokeBlocksWrite: true,
      backgroundRefreshKeepsFreshAction: true,
      aiModuleIndependentOfGpu: true,
      lateSchoolResponseIgnored: true,
      expiryClearsContext: true,
      earliestGrantRefetchPreservesRemainingScope:true,
      ownedNotesRetained: true,
      mobile320: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
