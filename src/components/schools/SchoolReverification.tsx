"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { schoolsRequest, type SchoolMembership } from "@/lib/schoolsClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineFeedback } from "@/components/ui/product-motion";
function verificationError(message: string) {
  if (message.includes("DUPLICATE_STUDENT_NUMBER"))
    return "이 학교와 학년도에 이미 등록된 학번이에요. 본인의 학번을 확인해주세요.";
  if (message.includes("INVALID_STUDENT_NUMBER"))
    return "요구되는 새 학년과 학년도에 맞는 학번을 입력해주세요.";
  if (message.includes("REVERIFICATION_NOT_REQUIRED"))
    return "현재 이 학교 소속은 학번 재인증 대상이 아니에요. 학교 목록에서 상태를 확인해주세요.";
  if (message.includes("UNSUPPORTED_ACADEMIC_POLICY"))
    return "이 학교의 학번 정책은 아직 지원하지 않아요. 학교 관리자에게 문의해주세요.";
  return message;
}
export default function SchoolReverification({
  schoolId,
}: {
  schoolId: string;
}) {
  const { user } = useAuth();
  return <Verification key={schoolId + ":" + user?.id} schoolId={schoolId} />;
}
function Verification({ schoolId }: { schoolId: string }) {
  const { user, isLoading } = useAuth();
  const [member, setMember] = useState<SchoolMembership | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [number, setNumber] = useState("");
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    setLoading(true);
    if (!user) {
      setLoading(false);
      return;
    }
    void schoolsRequest<{ items: SchoolMembership[] }>("memberships")
      .then((data) => {
        if (live.current)
          setMember(
            data.items.find(
              (m) => m.school_id === schoolId && m.user_id === user.id,
            ) || null,
          );
      })
      .catch((e) => {
        if (live.current) setError(verificationError(e.message));
      })
      .finally(() => {
        if (live.current) setLoading(false);
      });
    return () => {
      live.current = false;
    };
  }, [schoolId, user]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      busy ||
      !member ||
      member.status !== "REVERIFICATION_REQUIRED" ||
      schoolId !== "cbsh" ||
      !member.reverification_school_year
    )
      return;
    if (
      !/^[1-3][1-3]\d{2}$/.test(number) ||
      Number(number[0]) !== member.required_grade
    ) {
      setError("학교에서 요구하는 새 학년과 4자리 학번을 확인해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const value = await schoolsRequest<{
        membership: SchoolMembership;
        requires_review: boolean;
      }>(
        "schools/" + encodeURIComponent(schoolId) + "/academic/reverify",
        "POST",
        {
          school_year: member.reverification_school_year,
          student_number: number,
        },
      );
      if (!live.current) return;
      if (
        value.membership.school_id !== schoolId ||
        value.membership.user_id !== user?.id ||
        value.requires_review !== true
      )
        throw Error("학교 소속 응답을 확인하지 못했어요. 다시 조회해주세요.");
      setMember({ ...member, ...value.membership, school: member.school });
      setNumber("");
      setNotice(
        "새 학번을 제출했어요. 학교 관리자의 확인 전까지 학교 자원은 제한되며, 개인 프로젝트는 계속 사용할 수 있어요.",
      );
      window.dispatchEvent(new Event("cbgpu-school-changed"));
    } catch (e) {
      if (live.current) setError(verificationError((e as Error).message));
    } finally {
      if (live.current) setBusy(false);
    }
  }
  if (isLoading || loading)
    return <p role="status">학교 소속을 확인하고 있어요…</p>;
  if (!user)
    return (
      <p>
        <Link href="/auth/login" className="text-primary underline">
          로그인 후 학교 소속을 확인해주세요.
        </Link>
      </p>
    );
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <header>
        <h1 className="cb-page-title">학교 소속 재인증</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          계정과 개인 프로젝트는 유지돼요. 새 학번은 학교 관리자의 확인을 거친
          뒤 학교 자원 권한에 반영돼요.
        </p>
      </header>
      <InlineFeedback message={error} />
      <InlineFeedback kind="success" message={notice} />
      {!member ? (
        <p>이 학교의 본인 소속 정보를 확인할 수 없어요.</p>
      ) : (
        <div className="rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">
            {member.school.display_name || member.school.official_name}
          </h2>
          <p className="text-sm">
            {member.status === "PENDING_VERIFICATION"
              ? "학교 관리자 확인 대기"
              : member.status === "REVERIFICATION_REQUIRED"
                ? "새 학번 인증 필요"
                : member.status === "ACTIVE" && member.verified
                  ? "학교 소속 인증 완료"
                  : "학교 소속 확인 필요"}
          </p>
          {member.status === "REVERIFICATION_REQUIRED" &&
          schoolId === "cbsh" &&
          member.membership_type === "STUDENT" &&
          member.reverification_school_year ? (
            <form onSubmit={submit} className="cb-school-step-body">
              <p className="text-sm">
                대상 학년도: {member.reverification_school_year} · 새 학년:{" "}
                {member.required_grade}학년
              </p>
              <label className="cb-school-field">
                <span>본인의 새 학번</span>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  required
                  disabled={busy}
                  value={number}
                  onChange={(e) =>
                    setNumber(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? "제출 중…" : "학교 소속 확인 요청"}
              </Button>
            </form>
          ) : member.status === "REVERIFICATION_REQUIRED" ? (
            <p className="text-sm">
              이 학교의 학번 정책은 아직 지원하지 않아요. 학교 관리자에게
              문의해주세요.
            </p>
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/schools" className="text-primary underline">
          내 학교 보기
        </Link>
        <Link href="/workspace" className="text-primary underline">
          개인 프로젝트와 서비스로 돌아가기
        </Link>
      </div>
    </section>
  );
}
