import assert from "node:assert/strict";
import test from "node:test";
import {
  academicConfirmation,
  academicPreviewValid,
  academicError,
  type AcademicPreview,
} from "../src/lib/schoolAcademic.ts";
const preview: AcademicPreview = {
  school_id: "cbsh",
  school_year: 2027,
  supported: true,
  preview_fingerprint: "a".repeat(64),
  counts: { grade1: 1, grade2: 1, grade3: 1, invalid: 0 },
  items: [
    {
      membership_id: "one",
      user_id: "u",
      student_number: "1101",
      grade: 1,
      action: "REVERIFICATION_REQUIRED",
    },
  ],
  errors: [],
};
test("academic confirmation binds school/year and rejects unsupported or invalid previews", () => {
  assert.equal(academicConfirmation("cbsh", 2027), "ROLLOVER cbsh 2027");
  assert.equal(academicPreviewValid(preview, "cbsh", 2027), true);
  for (const patch of [
    { school_id: "other" },
    { school_year: 2026 },
    { supported: false },
    { preview_fingerprint: "stale" },
    { counts: { ...preview.counts, invalid: 1 } },
    { errors: ["invalid"] },
    { items: [{ ...preview.items[0], action: "INVALID" as const }] },
  ])
    assert.equal(
      academicPreviewValid({ ...preview, ...patch }, "cbsh", 2027),
      false,
    );
});
test("stale-preview and unsupported-policy failures explain safe recovery", () => {
  assert.match(academicError("ACADEMIC_PREVIEW_CHANGED"), /fresh preview/);
  assert.match(academicError("UNSUPPORTED_ACADEMIC_POLICY"), /No rollover/);
  assert.match(academicError("DUPLICATE_STUDENT_NUMBER"), /already registered/);
});
