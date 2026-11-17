"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import { schoolsRequest } from "@/lib/schoolsClient";
import {
  academicConfirmation,
  academicError,
  academicPreviewValid,
  type AcademicHistory,
  type AcademicPreview,
  type AcademicResult,
} from "@/lib/schoolAcademic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineFeedback } from "@/components/ui/product-motion";
export default function SchoolAcademicYear({ schoolId }: { schoolId: string }) {
  const { user } = useAuth();
  return (
    <AcademicWorkspace key={schoolId + ":" + user?.id} schoolId={schoolId} />
  );
}
function AcademicWorkspace({ schoolId }: { schoolId: string }) {
  const currentYear = new Date().getFullYear(),
    [year, setYear] = useState(currentYear + 1),
    [preview, setPreview] = useState<AcademicPreview | null>(null),
    [history, setHistory] = useState<AcademicHistory[]>([]),
    [result, setResult] = useState<AcademicResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const live = useRef(true);
  const path = "admin/schools/" + encodeURIComponent(schoolId) + "/academic";
  function clearPreview() {
    setPreview(null);
    setAck(false);
    setConfirmation("");
  }
  async function loadHistory() {
    try {
      const data = await schoolsRequest<{ items: AcademicHistory[] }>(
        path + "/history",
      );
      if (live.current)
        setHistory(data.items.filter((item) => item.school_id === schoolId));
    } catch (e) {
      if (live.current) setError(academicError((e as Error).message));
    }
  }
  useEffect(() => {
    live.current = true;
    if (schoolId === "cbsh") void loadHistory();
    return () => {
      live.current = false;
    };
  }, [schoolId]);
  async function prepare(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    clearPreview();
    try {
      const value = await schoolsRequest<AcademicPreview>(
        path + "/preview?school_year=" + year,
      );
      if (!live.current) return;
      if (value.school_id !== schoolId || value.school_year !== year)
        throw Error(
          "Preview school or year does not match. No changes were made.",
        );
      setPreview(value);
    } catch (e) {
      if (live.current) setError(academicError((e as Error).message));
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function execute(e: FormEvent) {
    e.preventDefault();
    if (
      busy ||
      !preview ||
      !academicPreviewValid(preview, schoolId, year) ||
      !ack ||
      confirmation !== academicConfirmation(schoolId, year)
    )
      return;
    setBusy(true);
    setError("");
    try {
      const value = await schoolsRequest<AcademicResult>(
        path + "/execute",
        "POST",
        {
          school_year: year,
          preview_fingerprint: preview.preview_fingerprint,
          confirmed: true,
        },
      );
      if (!live.current) return;
      if (
        !value.ok ||
        value.school_id !== schoolId ||
        value.school_year !== year
      )
        throw Error(
          "Review execution history before retrying: the result could not be verified.",
        );
      setResult(value);
      clearPreview();
      window.dispatchEvent(new Event("cbgpu-school-changed"));
      await loadHistory();
    } catch (e) {
      if (live.current) {
        setError(academicError((e as Error).message));
        clearPreview();
        await loadHistory();
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  if (schoolId !== "cbsh")
    return (
      <section className="rounded-xl border p-5 space-y-3">
        <h2 className="text-xl font-semibold">Academic Year Rollover</h2>
        <p className="text-sm text-muted-foreground">
          This school’s student-number and grade policy is not supported yet. No
          rollover action is available. Memberships, accounts and projects
          remain unchanged.
        </p>
      </section>
    );
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Academic Year Rollover</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          School: {schoolId}. Only this school’s verified, active student
          memberships are considered. Teacher and external memberships, global
          identity and projects are preserved. Nothing runs automatically.
        </p>
      </header>
      <InlineFeedback message={error} />
      <form
        className="cb-school-step-body rounded-xl border p-4"
        onSubmit={prepare}
      >
        <label className="cb-school-field">
          <span>Target academic year</span>
          <Input
            type="number"
            min={currentYear}
            max={currentYear + 1}
            value={year}
            required
            disabled={busy}
            onChange={(e) => {
              setYear(Number(e.target.value));
              clearPreview();
              setResult(null);
              setError("");
            }}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "Checking…" : "Preview membership changes"}
        </Button>
      </form>
      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Grade 1 → grade 2 verification", preview.counts.grade1],
              ["Grade 2 → grade 3 verification", preview.counts.grade2],
              ["Grade 3 → external membership", preview.counts.grade3],
              ["Invalid student numbers", preview.counts.invalid],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <strong className="text-2xl">{count}</strong>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <caption className="p-3 text-left">
                {preview.school_id} · {preview.school_year} ·{" "}
                {preview.items.length} target memberships
              </caption>
              <thead>
                <tr>
                  {[
                    "Membership",
                    "Student number",
                    "Current grade",
                    "Result",
                  ].map((title) => (
                    <th key={title} className="p-3">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.membership_id} className="border-t">
                    <td className="p-3">
                      <span className="block max-w-40 break-all text-xs">
                        {item.membership_id}
                      </span>
                    </td>
                    <td className="p-3">{item.student_number || "—"}</td>
                    <td className="p-3">{item.grade || "—"}</td>
                    <td className="p-3">
                      {item.action === "REVERIFICATION_REQUIRED"
                        ? "Student-number reset and manual reverification"
                        : item.action === "EXTERNAL"
                          ? "External school membership"
                          : "Invalid — review required"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!academicPreviewValid(preview, schoolId, year) ? (
            <InlineFeedback message="This preview cannot execute. Resolve invalid data or unsupported policy and request a new preview." />
          ) : (
            <form
              onSubmit={execute}
              className="cb-school-step-body rounded-xl border border-amber-500/40 p-4"
            >
              <h3 className="font-semibold">
                Final administrator confirmation
              </h3>
              <p className="text-sm">
                School {schoolId} · target year {year} ·{" "}
                {preview.counts.grade1 + preview.counts.grade2} awaiting
                reverification · {preview.counts.grade3} external memberships.
              </p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Grades 1–2 lose their old student numbers and school resource
                  access until the new number is reviewed.
                </li>
                <li>
                  Grade 3 becomes an external membership in this school only.
                </li>
                <li>
                  Accounts, passwords, personal projects and project memberships
                  are retained. Other schools’ memberships are unchanged.
                </li>
                <li>
                  The server rejects duplicate years and changes made since this
                  preview.
                </li>
              </ul>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ack}
                  required
                  disabled={busy}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I reviewed the target school, year, accounts and student-number
                interpretation, and confirmed a valid backup and recovery
                procedure.
              </label>
              <label className="cb-school-field">
                <span>Type {academicConfirmation(schoolId, year)}</span>
                <Input
                  autoComplete="off"
                  required
                  disabled={busy}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={clearPreview}
                >
                  Cancel preview
                </Button>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !ack ||
                    confirmation !== academicConfirmation(schoolId, year)
                  }
                >
                  {busy ? "Executing transaction…" : "Execute school rollover"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {result && (
        <div role="status" className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">School rollover completed</h3>
          <p className="text-sm">
            {result.school_id} · {result.school_year} ·{" "}
            {result.counts.grade1 + result.counts.grade2} reverifications ·{" "}
            {result.counts.grade3} external memberships.
          </p>
          <p className="break-all text-xs text-muted-foreground">
            Execution {result.id} ·{" "}
            {new Date(result.completed_at).toLocaleString()}
          </p>
        </div>
      )}
      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <h3 className="font-semibold">Completed execution history</h3>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void loadHistory()}
          >
            Refresh history
          </Button>
        </div>
        {history.length ? (
          history.map((item) => (
            <article key={item.id} className="rounded-lg border p-3 text-sm">
              <strong>
                {item.school_id} · {item.school_year}
              </strong>
              <p>
                {item.counts.grade1 + item.counts.grade2} reverifications ·{" "}
                {item.counts.grade3} external memberships
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {item.id} · {new Date(item.completed_at).toLocaleString()}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No completed rollover is recorded for this school.
          </p>
        )}
      </section>
    </section>
  );
}
