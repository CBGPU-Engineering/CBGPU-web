"use client";
import{schoolStatusLabel,schoolAdminError}from'@/lib/schoolAdminKorean';
import {Dropdown} from '@/components/ui/dropdown';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import SchoolLifeReadiness from "./SchoolLifeReadiness";
import { useAuth } from "@/lib/useAuth";
import { schoolsRequest } from "@/lib/schoolsClient";
import {
  LIFE_URL_FIELDS,
  lifeDraft,
  reviewedLifePayload,
  type LifeDraft,
  type SchoolLifeSources,
} from "@/lib/schoolLifeSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineFeedback } from "@/components/ui/product-motion";
const labels = {
  homepage_url: "학교 홈페이지",
  news_url: "학교 소식",
  letter_url: "가정통신문",
  calendar_url: "학사 일정",
  meal_url: "급식 정보",
};
export default function SchoolLifeSettings({
  schoolId,
  editor = false,
}: {
  schoolId: string;
  editor?: boolean;
}) {
  const { user } = useAuth();
  return (
    <Settings
      key={schoolId + ":" + user?.id}
      schoolId={schoolId}
      editor={editor}
    />
  );
}
function Settings({ schoolId, editor }: { schoolId: string; editor: boolean }) {
  const { user, isAdmin, isLoading } = useAuth(),
    [source, setSource] = useState<SchoolLifeSources | null>(null),
    [draft, setDraft] = useState<LifeDraft | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false),
    [stale, setStale] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const live = useRef(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSource(null);
    setDraft(null);
    setAck(false);
    try {
      const value = await schoolsRequest<SchoolLifeSources>(
        (editor ? "admin/schools/" : "schools/") +
          encodeURIComponent(schoolId) +
          "/life-sources",
      );
      if (!live.current) return;
      if (value.school_id !== schoolId)
        throw Error("다른 학교의 정보 출처가 응답했어요. 다시 확인해 주세요.");
      setSource(value);
      setDraft(lifeDraft(value));
      setStale(false);
    } catch (e) {
      if (live.current) setError(schoolAdminError(e));
    } finally {
      if (live.current) setLoading(false);
    }
  }, [schoolId, editor]);
  useEffect(() => {
    live.current = true;
    if (user && (!editor || isAdmin)) void load();
    else setLoading(false);
    return () => {
      live.current = false;
    };
  }, [user?.id, isAdmin, editor, load]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!source || !draft || !editor || !isAdmin || stale || busy) return;
    setError("");
    setNotice("");
    let payload;
    try {
      payload = reviewedLifePayload(draft, source, schoolId, ack);
    } catch (e) {
      setError(schoolAdminError(e));
      return;
    }
    setBusy(true);
    try {
      const value = await schoolsRequest<{ ok: boolean }>(
        "admin/schools/" + encodeURIComponent(schoolId) + "/life-sources",
        "PATCH",
        payload,
      );
      if (!live.current) return;
      if (value.ok !== true)
        throw Error("정보 출처 검토 결과를 확인하지 못했어요.");
      setNotice(
        "정보 출처를 저장했어요. 연결 상태와 학교 기능 설정도 확인해 주세요.",
      );
      await load();
      window.dispatchEvent(new Event("cbgpu-school-changed"));
    } catch (e) {
      if (live.current) {
        const message = (e as Error).message;
        if (
          message.includes("SOURCE_VERSION_CONFLICT") ||
          (e as { code?: string }).code === "SOURCE_VERSION_CONFLICT"
        ) {
          setStale(true);
          setAck(false);
          setError(
            "다른 관리자가 연결 설정을 변경했어요. 아래 입력은 유지되니 최신 설정과 비교하고 다시 검토해 주세요.",
          );
        } else setError(schoolAdminError(message));
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  if (isLoading || loading)
    return <p role="status">{"학교 연동을 불러오고 있어요…"}</p>;
  if (!user || (editor && !isAdmin))
    return (
      <p role="alert">{"정보 출처를 검토하려면 플랫폼 관리자 권한이 필요해요."}</p>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {editor ? "학교 정보 출처 검토" : "학교 연동"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{"학교별 시간표·소식·학사 일정·급식 연동이에요. 제공 기관과 정보 출처 호스트는 플랫폼 관리자만 승인할 수 있어요."}</p>
        </div>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal text-center"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
        >
          {stale ? "최신 설정 불러오기 (미저장 입력 삭제)" : "연동 새로고침"}
        </Button>
      </header>
      <InlineFeedback message={error} />
      <InlineFeedback kind="success" message={notice} />
      {!source ? (
        <p className="text-sm text-muted-foreground">{"연결 설정을 불러오지 못했어요. 로그인 상태와 이 학교의 관리 권한을 확인한 뒤 새로고침해 주세요."}</p>
      ) : (
        <>
          {!editor&&<SchoolLifeReadiness source={source}/>}
          <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{"학교"}</dt>
              <dd>
                {source.school_name} · {source.region}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{"설정 버전"}</dt>
              <dd>
                {source.version} · {schoolStatusLabel(source.status)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{"시간표 제공 기관"}</dt>
              <dd>
                {schoolStatusLabel(source.comcigan.status)}
                {source.comcigan.school_code
                  ? ` · ${source.comcigan.school_code}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{"급식 제공 기관"}</dt>
              <dd>{source.meal_provider==='NEIS'?'나이스':source.meal_provider==='SCHOOL_WEBSITE'?'학교 홈페이지':'미설정'}</dd>
            </div>
          </dl>
          {source.status === "DISABLED" ? (
            <p className="text-sm text-muted-foreground">{"학교생활 기능이 꺼져 있어요. 연결 설정을 검토·교체하려면 먼저 학교 기능을 켜 주세요. 기존 데이터는 유지돼요."}</p>
          ) : editor && draft ? (
            <form
              onSubmit={save}
              className="cb-school-step-body rounded-xl border p-4"
            >
              <p className="text-sm text-muted-foreground">{"다음 학교의 정보 출처 설정 전체를 교체해요: "}{" "}
                {schoolId}{" · 빈 선택 주소는 해당 연동을 제거해요. 모든 주소와 제공 기관 정보를 공식 학교 정보와 비교해 주세요."}</p>
              <label className="cb-school-field">
                <span>{"검토한 허용 호스트 (한 줄에 하나)"}</span>
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  value={draft.allowed_hosts}
                  onChange={(e) => {
                    setDraft({ ...draft, allowed_hosts: e.target.value });
                    setAck(false);
                  }}
                />
              </label>
              {LIFE_URL_FIELDS.map((field) => (
                <label key={field} className="cb-school-field">
                  <span>{labels[field]}{" 주소 (선택)"}</span>
                  <Input
                    type="url"
                    maxLength={2048}
                    disabled={busy}
                    value={draft[field]}
                    onChange={(e) => {
                      setDraft({ ...draft, [field]: e.target.value });
                      setAck(false);
                    }}
                  />
                </label>
              ))}
              <label className="cb-school-field">
                <span>{"급식 제공 기관"}</span>
                <Dropdown
                  disabled={busy}
                  value={draft.meal_provider}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      meal_provider: e.target
                        .value as LifeDraft["meal_provider"],
                    });
                    setAck(false);
                  }}
                >
                  <option value="">{"미설정"}</option>
                  <option value="NEIS">나이스 (NEIS)</option>
                  <option value="SCHOOL_WEBSITE">{"학교 홈페이지"}</option>
                </Dropdown>
              </label>
              <label className="cb-school-field">
                <span>{"검토한 컴시간 학교 코드 (선택)"}</span>
                <Input
                  inputMode="numeric"
                  maxLength={9}
                  disabled={busy}
                  value={draft.comcigan_school_code}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      comcigan_school_code: e.target.value,
                    });
                    setAck(false);
                  }}
                />
              </label>
              <p className="text-sm text-muted-foreground">{"공식 학교 정보: "}{source.comcigan.school_name} ·{" "}
                {source.comcigan.region}{" · 코드가 비어 있으면 공식 학교명·지역을 정확히 조회해요. 다른 학교에 충북과고 정보를 대신 적용하지 않아요."}</p>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  required
                  disabled={busy}
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />{"이 학교의 공식 정보와 제공 기관을 확인하고, 삭제할 항목을 포함한 전체 변경 내용을 검토했어요."}</label>
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal text-center"
                type="submit"
                disabled={busy || !ack || stale}
              >
                {busy ? "검토 저장 중…" : "정보 출처 저장"}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">{"설정된 정보 출처"}</h3>
              {LIFE_URL_FIELDS.map((field) => (
                <div key={field} className="text-sm">
                  <p className="text-muted-foreground">{labels[field]}</p>
                  <p className="break-all">
                    {source[field] || "미설정"}
                  </p>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">{"학교 권한만으로 새 호스트나 임의 주소를 승인할 수 없어요. 플랫폼 운영진에게 연동 검토를 요청해 주세요."}</p>
              <Button asChild variant="outline">
                <Link
                  href={
                    "/schools/" + encodeURIComponent(schoolId) + "/features"
                  }
                >{"연동 검토 요청"}</Link>
              </Button>
              {isAdmin && (
                <Button asChild variant="outline">
                  <Link
                    href={
                      "https://admin.cbgpu.com/admin/schools/" +
                      encodeURIComponent(schoolId) +
                      "/life-sources"
                    }
                  >{"플랫폼 정보 출처 검토"}</Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
