"use client";
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
  homepage_url: "Official homepage",
  news_url: "School news",
  letter_url: "School letters",
  calendar_url: "School calendar",
  meal_url: "Meal source",
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
        throw Error("Source response belongs to another school.");
      setSource(value);
      setDraft(lifeDraft(value));
      setStale(false);
    } catch (e) {
      if (live.current) setError((e as Error).message);
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
      setError((e as Error).message);
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
        throw Error("Source review was not confirmed by the server.");
      setNotice(
        "Reviewed sources saved for this school. Runtime availability remains subject to source and feature checks.",
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
            "Another review changed these sources. Your edits are retained below. Reload the latest version, compare your edits, and confirm a new review before saving.",
          );
        } else setError(message);
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  if (isLoading || loading)
    return <p role="status">Loading school integrations…</p>;
  if (!user || (editor && !isAdmin))
    return (
      <p role="alert">
        Platform administrator access is required to review source
        configuration.
      </p>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {editor ? "Reviewed school sources" : "School integrations"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            School-specific timetable, news, calendar and meal integrations.
            Only platform administrators can approve provider mappings or source
            hosts.
          </p>
        </div>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal text-center"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
        >
          {stale ? "Reload latest (discard unsaved edits)" : "Reload sources"}
        </Button>
      </header>
      <InlineFeedback message={error} />
      <InlineFeedback kind="success" message={notice} />
      {!source ? (
        <p className="text-sm text-muted-foreground">
          Current sources could not be read. Editing is unavailable. The server
          must verify your current platform role and session for this school.
        </p>
      ) : (
        <>
          {!editor&&<SchoolLifeReadiness source={source}/>}
          <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">School</dt>
              <dd>
                {source.school_name} · {source.region}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Configuration version (not provider health)
              </dt>
              <dd>
                {source.version} · {source.status}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Timetable provider
              </dt>
              <dd>
                {source.comcigan.status}
                {source.comcigan.school_code
                  ? ` · ${source.comcigan.school_code}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Meal provider</dt>
              <dd>{source.meal_provider || "Not configured"}</dd>
            </div>
          </dl>
          {source.status === "DISABLED" ? (
            <p className="text-sm text-muted-foreground">
              School life is disabled. Enable the school feature before
              inspecting or replacing reviewed sources; existing data remains
              stored.
            </p>
          ) : editor && draft ? (
            <form
              onSubmit={save}
              className="cb-school-step-body rounded-xl border p-4"
            >
              <p className="text-sm text-muted-foreground">
                This replaces the complete reviewed source configuration for{" "}
                {schoolId}. Blank optional URLs remove that source. Confirm
                every URL and the provider mapping against official school
                information.
              </p>
              <label className="cb-school-field">
                <span>Reviewed allowed hosts (one per line)</span>
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
                  <span>{labels[field]} URL (optional)</span>
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
                <span>Meal provider</span>
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
                  <option value="">Not configured</option>
                  <option value="NEIS">NEIS</option>
                  <option value="SCHOOL_WEBSITE">School website</option>
                </Dropdown>
              </label>
              <label className="cb-school-field">
                <span>Reviewed Comcigan school code (optional)</span>
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
              <p className="text-sm text-muted-foreground">
                Canonical mapping: {source.comcigan.school_name} ·{" "}
                {source.comcigan.region}. Leave the code empty to use exact
                canonical lookup; no CBsh fallback is assigned to other schools.
              </p>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  required
                  disabled={busy}
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I independently verified this school, each public source host
                and provider mapping, and reviewed the complete replacement
                including removed fields.
              </label>
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal text-center"
                type="submit"
                disabled={busy || !ack || stale}
              >
                {busy ? "Saving review…" : "Save reviewed source configuration"}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Configured sources</h3>
              {LIFE_URL_FIELDS.map((field) => (
                <div key={field} className="text-sm">
                  <p className="text-muted-foreground">{labels[field]}</p>
                  <p className="break-all">
                    {source[field] || "Not configured"}
                  </p>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                School roles cannot approve new hosts or arbitrary source URLs.
                Request a curated integration from the platform team.
              </p>
              <Button asChild variant="outline">
                <Link
                  href={
                    "/schools/" + encodeURIComponent(schoolId) + "/features"
                  }
                >
                  Request integration review
                </Link>
              </Button>
              {isAdmin && (
                <Button asChild variant="outline">
                  <Link
                    href={
                      "https://admin.cbgpu.com/admin/schools/" +
                      encodeURIComponent(schoolId) +
                      "/life-sources"
                    }
                  >
                    Open platform source review
                  </Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
