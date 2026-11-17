/** Synthetic only: exercises UI intent against owner-bound mocked APIs, never a real model/robot/job. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin =
  process.env.CBGPU_AI_RESOURCE_TEST_ORIGIN || "http://localhost:3248";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CBGPU_CHROMIUM || "/tmp/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
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
  let allowed = false,
    jobWrites = 0,
    searchWrites = 0,
    messageWrites = 0,
    planWrites = 0,
    keyWrites = 0,
    cancelWrites = 0,
    statusReads = 0;
  const chatId = "10000000-0000-4000-8000-000000000001",
    jobId = "10000000-0000-4000-8000-000000000002",
    planId = "10000000-0000-4000-8000-000000000003";
  const school = {
    id: "cbsh",
    official_name: "Synthetic CBsh",
    display_name: "Synthetic CBsh",
    type: "HIGH_SCHOOL",
    region: "Synthetic",
    features: ["gpu_compute", "ai", "projects"],
  };
  const expires = new Date(Date.now() + 180_000).toISOString();
  await page.route("**/api/schools/**", async (route) => {
    const path = new URL(route.request().url()).pathname.slice(
      "/api/schools/".length,
    );
    let data: any;
    if (path === "memberships") data = { items: [], current_school_id: "cbsh" };
    else if (path === "resource-contexts")
      data = {
        items: [
          {
            school_id: "cbsh",
            school,
            type: "GUEST",
            resources: allowed ? ["gpu", "ai"] : ["gpu"],
            expires_at: expires,
            can_administer: false,
          },
        ],
        current_school_id: "cbsh",
        server_time: new Date().toISOString(),
      };
    else if (path === "schools/cbsh/resource-access")
      data = {
        school_id: "cbsh",
        legacy_cbsh_access: false,
        context_type: "GUEST",
        expires_at: expires,
        server_time: new Date().toISOString(),
        resources: {
          gpu: true,
          ai: allowed,
          study: false,
          school_storage: false,
          school_compute: false,
          fabrication: false,
          contests: false,
        },
        reasons: {
          gpu: "ALLOWED",
          ai: allowed ? "ALLOWED" : "FEATURE_DISABLED",
        },
      };
    else
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: '{"error":"Unexpected scoped path"}',
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  let chat: any = {
    id: chatId,
    title: "Retained conversation",
    updated: Date.now() / 1000,
    model: "cbgpu-chat",
    effort: "medium",
    messages: [
      {
        id: "saved-answer",
        role: "assistant",
        content: "Retained private answer.",
        state: "succeeded",
      },
    ],
  };
  let job: any = {
    id: jobId,
    title: "Retained work",
    kind: "chat",
    state: "failed",
    created: Date.now() / 1000,
    result: { text: "Retained private result." },
    artifacts: [],
  };
  let plan: any = { id: planId, state: "queued" };
  await page.route("**/api/ai/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.slice("/api/ai".length),
      method = request.method();
    assert.equal(
      request.headers().authorization,
      "Bearer " + session.access_token,
    );
    let data: any = {},
      status = 200;
    if (path === "/chats" && method === "GET")
      data = {
        chats: [{ id: chat.id, title: chat.title, updated: chat.updated }],
      };
    else if (path === "/chats/" + chatId && method === "GET") data = { chat };
    else if (path === "/chats/" + chatId + "/messages") {
      messageWrites++;
      chat = {
        ...chat,
        messages: [
          ...chat.messages,
          {
            id: "fresh-answer",
            role: "assistant",
            content: "Fresh approved answer.",
            state: "succeeded",
          },
        ],
      };
      data = { chat };
    } else if (path === "/projects" && method === "GET")
      data = {
        projects: [
          { id: "owned-project", title: "Retained project", files: [] },
        ],
      };
    else if (path === "/jobs" && method === "GET") data = { jobs: [job] };
    else if (path === "/jobs" && method === "POST") {
      jobWrites++;
      data = { job: { ...job, state: "succeeded" } };
    } else if (path === "/jobs/" + jobId && method === "GET") data = { job };
    else if (path === "/jobs/" + jobId + "/retry") {
      jobWrites++;
      data = { job: { ...job, state: "queued" } };
    } else if (path === "/jobs/" + jobId + "/cancel") {
      cancelWrites++;
      job = { ...job, state: "cancelled" };
      data = { ok: true };
    } else if (path === "/search") {
      searchWrites++;
      data = { job };
    } else if (path === "/status") {
      statusReads++;
      status = 403;
      data = { message: "Scheduler status unavailable for this fixture" };
    } else if (path === "/keys" && method === "GET")
      data = {
        keys: [
          {
            id: "retained-key",
            name: "Retained API key",
            prefix: "synthetic-prefix",
            created: Date.now() / 1000,
            last_used: null,
          },
        ],
      };
    else if (path === "/keys" && method === "POST") {
      keyWrites++;
      data = { key: "synthetic-key-not-live" };
    } else if (path === "/v1/robotics/plans" && method === "POST") {
      planWrites++;
      data = plan;
    } else if (path === "/v1/robotics/plans/" + planId) {
      if (method === "DELETE") {
        cancelWrites++;
        plan = { ...plan, state: "cancelled" };
      }
      data = plan;
    } else if (path === "/v1/robotics/devices") data = { devices: [] };
    else if (path === "/models") data = { models: [] };
    else {
      status = 404;
      data = { message: "Synthetic AI path not configured: " + path };
    }
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto(origin + "/ai?c=" + chatId, { waitUntil: "networkidle" });
  await page.getByText("Retained private answer.", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("메시지 입력").isDisabled(), false);
  await page.getByLabel("메시지 입력").fill("Keep my draft");
  assert.equal(
    await page
      .getByRole("button", { name: "메시지 보내기", exact: true })
      .isDisabled(),
    true,
  );
  allowed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          'button[aria-label="메시지 보내기"]',
        ) as HTMLButtonElement
      )?.disabled,
  );
  allowed = false;
  await page
    .getByRole("button", { name: "메시지 보내기", exact: true })
    .click();
  await page
    .getByRole("alert")
    .getByText(
      /이 학교에서 현재 해당 기능을 제공하지 않아요|현재 학교 자원 이용 권한/,
    )
    .waitFor();
  assert.equal(messageWrites, 0);
  assert.equal(
    await page.getByLabel("메시지 입력").inputValue(),
    "Keep my draft",
  );
  await page.getByText("Retained private answer.", { exact: true }).waitFor();
  allowed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          'button[aria-label="메시지 보내기"]',
        ) as HTMLButtonElement
      )?.disabled,
  );
  await page
    .getByRole("button", { name: "메시지 보내기", exact: true })
    .click();
  await page.getByText("Fresh approved answer.", { exact: true }).waitFor();
  assert.equal(messageWrites, 1);
  for (const tool of ["prompt", "search", "gpu"]) {
    allowed = true;
    await page.goto(origin + "/ai?tool=" + tool, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Retained work/ }).waitFor();
    if (tool === "prompt")
      await page.getByLabel("내용", { exact: true }).fill("Retain this prompt");
    if (tool === "search")
      await page.getByLabel("찾고 싶은 내용", { exact: true }).fill("My notes");
    const name =
      tool === "prompt"
        ? "프롬프트 최적화하기"
        : tool === "search"
          ? "의미로 검색"
          : "GPU 대기열에 등록";
    await page.getByRole("button", { name, exact: true }).waitFor();
    await page.waitForFunction(
      (buttonName) =>
        [...document.querySelectorAll("button")].some(
          (button) =>
            button.textContent?.trim() === buttonName && !button.disabled,
        ),
      name,
    );
    if (tool === "prompt") {
      const statusResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/ai/status",
      );
      await page.getByRole("button", { name: "새로고침", exact: true }).click();
      await statusResponse;
      assert.ok(statusReads > 0);
      await page.getByRole("button", { name: /Retained work/ }).waitFor();
    }
    allowed = false;
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(jobWrites, 0);
    assert.equal(searchWrites, 0);
    await page.getByRole("button", { name: /Retained work/ }).click();
    await page.getByText("Retained private result.", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "다시 실행", exact: true })
        .isDisabled(),
      true,
    );
    if (tool === "prompt") {
      allowed = true;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) =>
            button.textContent?.trim() === "다시 실행" && !button.disabled,
        ),
      );
      allowed = false;
      await page
        .getByRole("button", { name: "다시 실행", exact: true })
        .click();
      await page.getByRole("alert").waitFor();
      assert.equal(jobWrites, 0);
    }
  }
  allowed = false;
  await page.goto(origin + "/ai?tool=api", { waitUntil: "networkidle" });
  await page.getByText("Retained API key", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "키 만들기", exact: true })
      .isDisabled(),
    false,
  );
  await page.getByRole("button", { name: "키 만들기", exact: true }).click();
  await page.getByText("synthetic-key-not-live", { exact: true }).waitFor();
  assert.equal(keyWrites, 1);
  await page.getByRole("button", { name: /Retained work/ }).click();
  await page.getByText("Retained private result.", { exact: true }).waitFor();
  assert.equal(jobWrites, 0);
  allowed = true;
  await page.goto(origin + "/ai?tool=robotics&plan=" + planId, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "계획 취소", exact: true }).waitFor();
  allowed = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "계획 취소", exact: true }).click();
  await page
    .getByText("계획이 취소됐어요. 새 계획을 요청할 수 있어요.", {
      exact: false,
    })
    .waitFor();
  assert.equal(cancelWrites, 1);
  allowed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) =>
        button.textContent?.includes("계획 만들기") && !button.disabled,
    ),
  );
  allowed = false;
  await page.getByRole("button", { name: "계획 만들기", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(planWrites, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/cbgpu-ai-resource-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      ownedChatAndDraftRetained: true,
      freshChatRevocationBlocksWrite: true,
      validGuestChatAccepted: true,
      promptSearchGpuRechecked: true,
      historySurvivesStatus403: true,
      keysAvailableWithoutAi: true,
      robotCancelWithoutAi: true,
      robotPlanRechecked: true,
      mobile390: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
