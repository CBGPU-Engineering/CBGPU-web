"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { School, Check, Plus, Clock3 } from "lucide-react";
import { multiSchoolEnabled } from "@/lib/schoolsClient";
import { useSchoolScope } from "./SchoolScope";
import { useAuth } from "@/lib/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineFeedback } from "@/components/ui/product-motion";
import "./schools.css";
const resourceLabel: Record<string, string> = {
  gpu: "GPU",
  ai: "CBGPU AI",
  central_cpu: "중앙 CPU 할당",
  school_compute: "서버·프론트엔드 실행",
  school_storage: "학교 저장소",
  contests: "대회",
  fabrication: "제작 장비",
  study: "자습 신청",
};
export default function HeaderSchoolSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const trigger = useRef<HTMLButtonElement | null>(null),
    scope = useSchoolScope(),
    { user } = useAuth(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const identity=useRef(user?.id);identity.current=user?.id;
  useEffect(()=>{setOpen(false);setBusy(false);setError("")},[user?.id]);
  if (!multiSchoolEnabled || !user) return null;
  const resource = scope.resource,
    current = resource.current,
    label =
      current?.school.display_name || scope.school?.display_name || "학교 선택";
  async function choose(id: string) {
    if (busy) return;
    const owner=user?.id;
    setBusy(true);
    setError("");
    try {
      if (resource.items.some((item) => item.school_id === id))
        await resource.select(id);
      else await scope.switchSchool(id);
      if(identity.current===owner)setOpen(false);
    } catch (e) {
      if(identity.current===owner)setError((e as Error).message || "학교를 전환하지 못했어요.");
    } finally {
      if(identity.current===owner)setBusy(false);
    }
  }
  const members = resource.items.filter((item) => item.type === "MEMBERSHIP"),
    guests = resource.items.filter((item) => item.type === "GUEST");
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={"cb-header-school" + (compact ? " is-compact" : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          "학교 바꾸기 · " +
          label +
          (current?.type === "GUEST" ? " · 임시 자원 이용" : "")
        }
        onClick={() => setOpen(true)}
      >
        <School size={18} />
        {!compact && (
          <span>
            {resource.status === "loading" || scope.status === "loading"
              ? "학교 확인 중…"
              : label}
            {current?.type === "GUEST" ? " · 임시" : ""}
          </span>
        )}
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          className="cb-school-picker"
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected) {
              event.preventDefault();
              trigger.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>어느 학교의 기능을 이용할까요?</DialogTitle>
            <DialogDescription>
              선택한 학교는 계정에 저장돼 다른 기기에서도 이어져요. 학교를 바꿔도
              새로운 권한이 생기지 않고, 개인 프로젝트는 그대로 유지돼요.
            </DialogDescription>
          </DialogHeader>
          <InlineFeedback message={error || resource.error || scope.error} />
          <h3 className="text-sm font-semibold">내 학교 소속</h3>
          <ul className="cb-school-options">
            {members.length
              ? members.map((item) => (
                  <li key={item.school_id}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-current={
                        current?.school_id === item.school_id
                          ? "true"
                          : undefined
                      }
                      onClick={() => void choose(item.school_id)}
                    >
                      <span className="cb-school-option-icon">
                        <School size={19} />
                      </span>
                      <span>
                        <strong>{item.school.display_name}</strong>
                        <small>{item.school.region} · 인증된 소속</small>
                      </span>
                      {current?.school_id === item.school_id && (
                        <Check size={18} />
                      )}
                    </button>
                  </li>
                ))
              : scope.memberships
                  .filter(
                    (m) =>
                      m.verified &&
                      m.status === "ACTIVE" &&
                      m.school.status === "APPROVED",
                  )
                  .map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={busy}
                        aria-current={
                          scope.school?.id === m.school_id ? "true" : undefined
                        }
                        onClick={() => void choose(m.school_id)}
                      >
                        <span className="cb-school-option-icon">
                          <School size={19} />
                        </span>
                        <span>
                          <strong>{m.school.display_name}</strong>
                          <small>{m.school.region}</small>
                        </span>
                        {scope.school?.id === m.school_id && (
                          <Check size={18} />
                        )}
                      </button>
                    </li>
                  ))}
          </ul>
          {guests.length > 0 && (
            <>
              <h3 className="mt-3 text-sm font-semibold">
                승인된 임시 자원 · 학교 소속 아님
              </h3>
              <ul className="cb-school-options">
                {guests.map((item) => (
                  <li key={item.school_id}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-current={
                        current?.school_id === item.school_id
                          ? "true"
                          : undefined
                      }
                      onClick={() => void choose(item.school_id)}
                    >
                      <span className="cb-school-option-icon">
                        <Clock3 size={19} />
                      </span>
                      <span>
                        <strong>{item.school.display_name}</strong>
                        <small>
                          {item.resources
                            .map((id) => resourceLabel[id] || id)
                            .join(" · ")}
                        </small>
                        <small>
                          {item.expires_at
                            ? new Date(item.expires_at).toLocaleString(
                                "ko-KR",
                              ) + "까지"
                            : "현재 승인된 기간에만 이용"}
                        </small>
                      </span>
                      {current?.school_id === item.school_id && (
                        <Check size={18} />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            href="/schools"
            onClick={() => setOpen(false)}
            className="cb-school-join-link"
          >
            <Plus size={17} />
            학교 찾기·소속 확인 요청
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
