import test from "node:test";
import assert from "node:assert/strict";
import {
  lifeDraft,
  reviewedLifePayload,
  type SchoolLifeSources,
} from "../src/lib/schoolLifeSettings.ts";
const source: SchoolLifeSources = {
  school_id: "school-a",
  school_name: "School A",
  region: "Region",
  status: "READY",
  version: 2,
  allowed_hosts: ["school.example.edu"],
  homepage_url: "https://school.example.edu",
  news_url: null,
  letter_url: null,
  calendar_url: null,
  meal_url: null,
  meal_provider: null,
  comcigan: {
    status: "LOOKUP_REQUIRED",
    school_code: null,
    school_name: "School A",
    region: "Region",
  },
};
test("review payload retains exact school-specific hosts, sources and canonical provider mapping", () => {
  const draft = lifeDraft(source);
  const payload = reviewedLifePayload(draft, source, "school-a", true);
  assert.deepEqual(payload.allowed_hosts, ["school.example.edu"]);
  assert.equal(payload.homepage_url, "https://school.example.edu");
  assert.equal(payload.news_url, null);
  assert.equal(payload.comcigan_school_name, "School A");
  assert.equal(payload.confirmed, true);
  assert.equal(payload.expected_version,2);
});
test("unconfirmed, wrong-school and disabled-source replacement is refused", () => {
  for (const [school, confirmed, status] of [
    ["school-a", false, "READY"],
    ["school-b", true, "READY"],
    ["school-a", true, "DISABLED"],
  ] as const)
    assert.throws(() =>
      reviewedLifePayload(
        lifeDraft(source),
        { ...source, status },
        school,
        confirmed,
      ),
    );
});
test("review rejects wildcard/local hosts and cross-host credentials, ports or insecure URLs", () => {
  for (const patch of [
    { allowed_hosts: "*.example.edu" },
    { allowed_hosts: "host.local" },
    { homepage_url: "http://school.example.edu" },
    { homepage_url: "https://school.example.edu:444" },
    { homepage_url: "https://school.example.edu.evil.com" },
    { homepage_url: "https://user:pass@school.example.edu" },
    { homepage_url: "https://school.example.edu/#secret" },
    { comcigan_school_code: "0" },
  ])
    assert.throws(() =>
      reviewedLifePayload(
        { ...lifeDraft(source), ...patch },
        source,
        "school-a",
        true,
      ),
    );
});
