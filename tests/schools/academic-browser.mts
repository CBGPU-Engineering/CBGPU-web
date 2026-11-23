/** Isolated synthetic browser check; never executes an operating rollover. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.CBGPU_SCHOOLS_TEST_ORIGIN || "http://localhost:3241";
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
  const year = new Date().getFullYear() + 1,
    school = {
      id: "cbsh",
      official_name: "Synthetic CBsh",
      display_name: "Synthetic CBsh",
      type: "HIGH_SCHOOL",
      region: "Synthetic",
      status: "APPROVED",
      features: ["projects"],
      brand_color: "#17634d",
      logo_path: null,
    };
  let membership: any = {
    id: "member",
    user_id: session.user.id,
    school_id: "cbsh",
    membership_type: "STUDENT",
    status: "REVERIFICATION_REQUIRED",
    verified: false,
    school_roles: [],
    student_number: null,
    required_grade: 2,
    reverification_school_year: year,
    school,
  };
  const preview = {
    school_id: "cbsh",
    school_year: year,
    supported: true,
    preview_fingerprint: "a".repeat(64),
    counts: { grade1: 1, grade2: 1, grade3: 1, invalid: 0 },
    items: [
      {
        membership_id: "member",
        user_id: "synthetic-user",
        student_number: "1101",
        grade: 1,
        action: "REVERIFICATION_REQUIRED",
      },
    ],
    errors: [],
  };
  let attempts = 0,
    stale = true,
    history: any[] = [],
    academicReads = 0,
    reverifyWrites = 0;
  await page.route("**/api/schools/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice("/api/schools/".length);
    let data: any = {},
      status = 200;
    if (path === "memberships")
      data = { items: [membership], current_school_id: "cbsh" };
    else if (/^schools\/(cbsh|other-school)\/configuration$/.test(path))
      data = {
        school: { ...school, id: path.split("/")[1] },
        configuration: {
          display_name: school.display_name,
          brand_color: school.brand_color,
        },
        features: ["projects"],
        available_features: ["projects"],
        revision: 1,
        can_manage_roles: true,
      };
    else if (/^schools\/(cbsh|other-school)\/members$/.test(path))
      data = { items: [] };
    else if (path === "admin/schools/cbsh/academic/preview") {
      academicReads++;
      assert.equal(
        new URL(request.url()).searchParams.get("school_year"),
        String(year),
      );
      data = preview;
    } else if (path === "admin/schools/cbsh/academic/history")
      data = { items: history };
    else if (path === "admin/schools/cbsh/academic/execute") {
      attempts++;
      assert.deepEqual(request.postDataJSON(), {
        school_year: year,
        preview_fingerprint: preview.preview_fingerprint,
        confirmed: true,
      });
      if (stale) {
        status = 409;
        data = {
          error: "ACADEMIC_PREVIEW_CHANGED",
          code: "ACADEMIC_PREVIEW_CHANGED",
        };
      } else {
        const result = {
          ok: true,
          id: "synthetic-run",
          school_id: "cbsh",
          school_year: year,
          counts: preview.counts,
          completed_at: new Date().toISOString(),
        };
        history = [result];
        data = result;
      }
    } else if (path === "schools/cbsh/academic/reverify") {
      reverifyWrites++;
      assert.deepEqual(request.postDataJSON(), {
        school_year: year,
        student_number: "2309",
      });
      const { school, ...row } = membership;
      membership = {
        ...membership,
        ...row,
        status: "PENDING_VERIFICATION",
        student_number: "2309",
      };
      data = {
        membership: {
          ...row,
          status: "PENDING_VERIFICATION",
          student_number: "2309",
        },
        requires_review: true,
      };
    } else {
      status = 403;
      data = { error: "Synthetic endpoint forbidden" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto(origin + "/schools/other-school/admin?section=academic", {
    waitUntil: "networkidle",
  });
  await page
    .getByText(/student-number and grade policy is not supported/)
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Preview membership changes" })
      .count(),
    0,
  );
  assert.equal(academicReads, 0);
  await page.goto(origin + "/schools/cbsh/admin?section=academic", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: "Preview membership changes" })
    .click();
  await page
    .getByRole("heading", { name: "Final administrator confirmation" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Execute school rollover" })
      .isDisabled(),
    true,
  );
  await page.getByRole("checkbox", { name: /I reviewed/ }).check();
  await page
    .getByLabel("Type ROLLOVER cbsh " + year)
    .fill("ROLLOVER cbsh " + year);
  assert.equal(attempts, 0);
  await page.getByRole("button", { name: "Execute school rollover" }).click();
  await page.getByText(/Memberships changed after the preview/).waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Final administrator confirmation" })
      .count(),
    0,
  );
  assert.equal(attempts, 1);
  stale = false;
  await page
    .getByRole("button", { name: "Preview membership changes" })
    .click();
  await page.getByRole("checkbox", { name: /I reviewed/ }).check();
  await page
    .getByLabel("Type ROLLOVER cbsh " + year)
    .fill("ROLLOVER cbsh " + year);
  await page.getByRole("button", { name: "Execute school rollover" }).click();
  await page
    .getByRole("heading", { name: "School rollover completed" })
    .waitFor();
  assert.equal(attempts, 2);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/cbgpu-school-academic-mobile.png",
    fullPage: true,
  });
  await page.goto(origin + "/schools/cbsh/verification", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("본인의 새 학번").fill("1309");
  await page.getByRole("button", { name: "학교 소속 확인 요청" }).click();
  await page
    .getByText("학교에서 요구하는 새 학년과 4자리 학번을 확인해 주세요.")
    .waitFor();
  assert.equal(reverifyWrites, 0);
  await page.getByLabel("본인의 새 학번").fill("2309");
  await page.getByRole("button", { name: "학교 소속 확인 요청" }).click();
  await page.getByText("학교 관리자 확인 대기", { exact: true }).waitFor();
  assert.equal(reverifyWrites, 1);
  assert.equal(
    await page.getByRole("button", { name: "학교 소속 확인 요청" }).count(),
    0,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      unsupportedSchoolNoMutation: true,
      explicitSchoolYearConfirmation: true,
      stalePreviewRequiresReview: true,
      completedHistory: true,
      wrongGradeNoWrite: true,
      pendingManualReview: true,
      mobile320: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
