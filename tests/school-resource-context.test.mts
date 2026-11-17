import test from "node:test";
import assert from "node:assert/strict";
import {
  validResourceContexts,
  resourceAllowed,
  resourceLeaseActive,
  type ResourceAccess,
  type ResourceContext,
} from "../src/lib/schoolResourceContext.ts";
import { schoolServiceVisible } from "../src/lib/schoolVisibility.ts";
const now = Date.parse("2026-11-17T10:00:00Z"),
  end = "2026-11-17T11:00:00Z";
const guest: ResourceContext = {
  school_id: "cbsh",
  school: {
    id: "cbsh",
    official_name: "School",
    display_name: "School",
    region: "Test",
    type: "HIGH_SCHOOL",
    features: ["gpu_compute", "school_life"],
  },
  type: "GUEST",
  resources: ["gpu", "school_compute"],
  expires_at: end,
  can_administer: false,
};
const access: ResourceAccess = {
  school_id: "cbsh",
  legacy_cbsh_access: false,
  context_type: "GUEST",
  expires_at: end,
  server_time: new Date(now).toISOString(),
  resources: {
    gpu: true,
    study: false,
    school_storage: false,
    fabrication: false,
    school_compute: true,
    contests: false,
  },
  reasons: { gpu: "ALLOWED", study: "NOT_GRANTED" },
};
test("guest resource context remains distinct from membership and grants only exact fresh effective scopes", () => {
  assert.equal(
    validResourceContexts({
      items: [guest],
      current_school_id: "cbsh",
      server_time: access.server_time,
    }).items[0].type,
    "GUEST",
  );
  assert.equal(resourceAllowed(guest, access, "gpu", now), true);
  assert.equal(resourceAllowed(guest, access, "study", now), false);
  assert.equal(
    resourceAllowed(guest, { ...access, school_id: "other" }, "gpu", now),
    false,
  );
  assert.equal(
    resourceAllowed(
      guest,
      { ...access, context_type: "MEMBERSHIP" },
      "gpu",
      now,
    ),
    false,
  );
  assert.equal(
    resourceAllowed(
      guest,
      { ...access, resources: { ...access.resources, gpu: false } },
      "gpu",
      now,
    ),
    false,
  );
});
test("earliest guest lease expires exactly at boundary and cannot be extended by cached UI", () => {
  assert.equal(resourceLeaseActive(end, Date.parse(end) - 1), true);
  assert.equal(resourceLeaseActive(end, Date.parse(end)), false);
  assert.equal(resourceAllowed(guest, access, "gpu", Date.parse(end)), false);
  assert.equal(resourceLeaseActive("invalid", now), false);
});
test("guest contexts never manufacture affiliation or administrator roles", () => {
  for (const patch of [
    { can_administer: true },
    { membership_id: "fake-member" },
    { expires_at: null },
    { resources: ["unknown"] },
  ])
    assert.throws(() =>
      validResourceContexts({
        items: [{ ...guest, ...patch } as ResourceContext],
        current_school_id: "cbsh",
        server_time: access.server_time,
      }),
    );
});
test("resource presentation exposes approved CBsh GPU but never guest school life or unrelated private resources", () => {
  const scope: any = {
    status: "none",
    school: null,
    resource: { status: "ready", current: guest, access, serverNow: now },
  };
  assert.equal(schoolServiceVisible(scope, "/dashboard"), true);
  for (const path of [
    "/study",
    "/wakeup",
    "/timetable",
    "/meal",
    "/manufacturing/print",
    "/match",
    "/polls",
  ])
    assert.equal(schoolServiceVisible(scope, path), false);
  for (const path of ["/notes", "/latex", "/server", "/deploy", "/ai"])
    assert.equal(schoolServiceVisible(scope, path), true);
  assert.equal(
    schoolServiceVisible(
      { ...scope, resource: { ...scope.resource, serverNow: Date.parse(end) } },
      "/dashboard",
    ),
    false,
  );
  const other = {
    ...guest,
    school_id: "other-school",
    school: { ...guest.school, id: "other-school" },
  };
  assert.equal(
    schoolServiceVisible(
      {
        ...scope,
        resource: {
          ...scope.resource,
          current: other,
          access: { ...access, school_id: "other-school" },
        },
      },
      "/dashboard",
    ),
    false,
  );
});

test('AI is a derived module capability, never inferred from GPU permission',()=>{
 const withAi={...guest,resources:[...guest.resources,'ai' as const]};
 assert.equal(resourceAllowed(withAi,{...access,resources:{...access.resources,ai:false}},'gpu',now),true);
 assert.equal(resourceAllowed(withAi,{...access,resources:{...access.resources,ai:false}},'ai',now),false);
 assert.equal(resourceAllowed(withAi,{...access,resources:{...access.resources,ai:true}},'ai',now),true);
 assert.equal(resourceAllowed(guest,access,'ai',now),false,'older API without module capability fails closed for AI only');
});
