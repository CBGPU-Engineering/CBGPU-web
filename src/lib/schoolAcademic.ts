export type AcademicCounts = {
  grade1: number;
  grade2: number;
  grade3: number;
  invalid: number;
};
export type AcademicPreview = {
  school_id: string;
  school_year: number;
  supported: boolean;
  preview_fingerprint: string;
  counts: AcademicCounts;
  items: {
    membership_id: string;
    user_id: string;
    student_number: string | null;
    grade: number | null;
    action: "INVALID" | "EXTERNAL" | "REVERIFICATION_REQUIRED";
  }[];
  errors: string[];
};
export type AcademicResult = {
  ok: boolean;
  id: string;
  school_id: string;
  school_year: number;
  counts: AcademicCounts;
  completed_at: string;
};
export type AcademicHistory = {
  id: string;
  school_id: string;
  school_year: number;
  actor_id: string;
  counts: AcademicCounts;
  completed_at: string;
};
export function academicConfirmation(school: string, year: number) {
  return `ROLLOVER ${school} ${year}`;
}
export function academicPreviewValid(
  preview: AcademicPreview,
  school: string,
  year: number,
) {
  return (
    preview.school_id === school &&
    preview.school_year === year &&
    preview.supported === true &&
    /^[a-f0-9]{64}$/i.test(preview.preview_fingerprint) &&
    preview.counts.invalid === 0 &&
    preview.errors.length === 0 &&
    preview.items.every((item) => item.action !== "INVALID")
  );
}
export function academicError(message: string) {
  const known: Record<string, string> = {
    UNSUPPORTED_ACADEMIC_POLICY:
      "This school’s student-number and grade policy is not supported yet. No rollover is available.",
    ACADEMIC_PREVIEW_CHANGED:
      "Memberships changed after the preview. Review a fresh preview before confirming again.",
    INVALID_STUDENT_NUMBERS_REQUIRE_REVIEW:
      "Resolve invalid student numbers before executing this transition.",
    INVALID_ACADEMIC_YEAR: "Choose the current or next calendar year.",
    SCHOOL_ADMIN_REQUIRED:
      "This school’s owner or administrator role is required.",
    REVERIFICATION_NOT_REQUIRED:
      "This membership does not currently require student-number reverification.",
    DUPLICATE_STUDENT_NUMBER:
      "That student number is already registered for this school and year.",
    INVALID_STUDENT_NUMBER:
      "The student number does not match the required school year or grade.",
  };
  return (
    Object.entries(known).find(([code]) => message.includes(code))?.[1] ||
    message
  );
}
