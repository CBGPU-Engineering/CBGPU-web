"use client";
import{schoolAdminError}from'@/lib/schoolAdminKorean';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import { schoolsRequest } from "@/lib/schoolsClient";
import {
  academicConfirmation,
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
      if (live.current) setError(schoolAdminError(e, "학년도 전환 정보를 확인하지 못했어요. 처리 이력과 현재 권한을 확인해 주세요."));
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
          "학교나 학년도가 맞지 않아요. 다시 미리보기를 확인해 주세요.",
        );
      setPreview(value);
    } catch (e) {
      if (live.current) setError(schoolAdminError(e, "학년도 전환 정보를 확인하지 못했어요. 처리 이력과 현재 권한을 확인해 주세요."));
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
          "실행 결과를 확인하지 못했어요. 다시 실행하기 전에 처리 이력을 확인해 주세요.",
        );
      setResult(value);
      clearPreview();
      window.dispatchEvent(new Event("cbgpu-school-changed"));
      await loadHistory();
    } catch (e) {
      if (live.current) {
        setError(schoolAdminError(e, "학년도 전환 정보를 확인하지 못했어요. 처리 이력과 현재 권한을 확인해 주세요."));
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
        <h2 className="text-xl font-semibold">{"학년도 전환"}</h2>
        <p className="text-sm text-muted-foreground">{"이 학교의 학번·학년 규칙은 아직 지원하지 않아 학년도 전환을 실행할 수 없어요. 학교 소속과 계정, 프로젝트는 그대로 유지돼요."}</p>
      </section>
    );
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">{"학년도 전환"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{"학교: "}{schoolId}{" · 이 학교에서 소속 확인을 마친 활성 학생만 대상이에요. 교사·외부인 소속, 계정과 프로젝트는 유지되며 자동으로 실행하지 않아요."}</p>
      </header>
      <InlineFeedback message={error} />
      <form
        className="cb-school-step-body rounded-xl border p-4"
        onSubmit={prepare}
      >
        <label className="cb-school-field">
          <span>{"대상 학년도"}</span>
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
          {busy ? "확인 중…" : "변경 미리보기"}
        </Button>
      </form>
      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["1학년 → 2학년 재인증", preview.counts.grade1],
              ["2학년 → 3학년 재인증", preview.counts.grade2],
              ["3학년 → 외부인 소속", preview.counts.grade3],
              ["확인이 필요한 학번", preview.counts.invalid],
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
                {preview.items.length}{"명 전환 대상"}</caption>
              <thead>
                <tr>
                  {[
                    "학교 소속",
                    "학번",
                    "현재 학년",
                    "처리 결과",
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
                        ? "학번 초기화 후 관리자 재인증"
                        : item.action === "EXTERNAL"
                          ? "이 학교의 외부인 소속으로 전환"
                          : "오류 · 확인 필요"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!academicPreviewValid(preview, schoolId, year) ? (
            <InlineFeedback message="이 미리보기로는 실행할 수 없어요. 학번 오류와 지원 규칙을 확인한 뒤 다시 미리보기를 요청해 주세요." />
          ) : (
            <form
              onSubmit={execute}
              className="cb-school-step-body rounded-xl border border-amber-500/40 p-4"
            >
              <h3 className="font-semibold">{"관리자 최종 확인"}</h3>
              <p className="text-sm">{"학교 "}{schoolId}{" · 대상 학년도 "}{year} ·{" "}
                {preview.counts.grade1 + preview.counts.grade2}{"명 재인증 대기 · "}{preview.counts.grade3}{"명 외부인 전환."}</p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>{"1·2학년은 기존 학번을 초기화하고 새 학번이 검토될 때까지 학교 자원 이용이 제한돼요."}</li>
                <li>{"3학년은 이 학교에서만 외부인 소속으로 바뀌어요."}</li>
                <li>{"계정·비밀번호·개인 프로젝트와 프로젝트 멤버십은 유지돼요. 다른 학교의 소속은 바뀌지 않아요."}</li>
                <li>{"이미 처리한 학년도나 미리보기 이후 변경된 내용은 실행할 수 없어요."}</li>
              </ul>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ack}
                  required
                  disabled={busy}
                  onChange={(e) => setAck(e.target.checked)}
                />{"대상 학교·학년도와 학생별 변경 내용을 검토하고, 백업과 복구 방법을 확인했어요."}</label>
              <label className="cb-school-field">
                <span>{"다음 문구를 그대로 입력해 주세요: "}{academicConfirmation(schoolId, year)}</span>
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
                >{"미리보기 취소"}</Button>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !ack ||
                    confirmation !== academicConfirmation(schoolId, year)
                  }
                >
                  {busy ? "전환 처리 중…" : "학년도 전환 실행"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {result && (
        <div role="status" className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">{"학년도를 전환했어요"}</h3>
          <p className="text-sm">
            {result.school_id} · {result.school_year} ·{" "}
            {result.counts.grade1 + result.counts.grade2}{"명 재인증 대기 · "}{" "}
            {result.counts.grade3}{"명 외부인 전환."}</p>
          <p className="break-all text-xs text-muted-foreground">{"실행 번호 "}{result.id} ·{" "}
            {new Date(result.completed_at).toLocaleString("ko-KR")}
          </p>
        </div>
      )}
      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <h3 className="font-semibold">{"학년도 전환 기록"}</h3>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void loadHistory()}
          >{"이력 새로고침"}</Button>
        </div>
        {history.length ? (
          history.map((item) => (
            <article key={item.id} className="rounded-lg border p-3 text-sm">
              <strong>
                {item.school_id} · {item.school_year}
              </strong>
              <p>
                {item.counts.grade1 + item.counts.grade2}{"명 재인증 대기 · "}{" "}
                {item.counts.grade3}{"명 외부인 전환"}</p>
              <p className="break-all text-xs text-muted-foreground">
                {item.id} · {new Date(item.completed_at).toLocaleString("ko-KR")}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{"아직 학년도 전환 기록이 없어요."}</p>
        )}
      </section>
    </section>
  );
}
