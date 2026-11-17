import test from "node:test";
import assert from "node:assert/strict";
import { schoolMembershipNotice } from "../src/lib/schoolMembershipNotice.ts";
const member: any = {
  user_id: "owner",
  school_id: "school-a",
  membership_type: "TEACHER",
  status: "PENDING_VERIFICATION",
  school: { display_name: "School A", official_name: "School A" },
};
test("pending teacher and student reverification messages describe school scope, never global student identity", () => {
  const notice = schoolMembershipNotice("owner", [member], "none");
  assert.match(notice!.text, /교사 소속/);
  assert.equal(notice!.href, "/schools");
  const reverify = schoolMembershipNotice(
    "owner",
    [
      {
        ...member,
        status: "REVERIFICATION_REQUIRED",
        membership_type: "STUDENT",
      },
    ],
    "none",
  );
  assert.equal(reverify!.href, "/schools/school-a/verification");
  assert.match(reverify!.text, /개인 프로젝트/);
});
test("external personal accounts, active school, unavailable and another owner never receive legacy student warnings", () => {
  for (const state of ["loading", "ready", "unavailable"])
    assert.equal(schoolMembershipNotice("owner", [member], state), null);
  assert.equal(schoolMembershipNotice("owner", [], "none"), null);
  assert.equal(schoolMembershipNotice("another", [member], "none"), null);
});
