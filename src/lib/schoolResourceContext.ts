export const RESOURCE_IDS = [
  "gpu",
  "study",
  "school_storage",
  "fabrication",
  "school_compute",
  "contests",
  "ai",
] as const;
export type SchoolResource = (typeof RESOURCE_IDS)[number];
export type ResourceSchool = {
  id: string;
  official_name: string;
  display_name: string;
  type: string;
  region: string;
  features: string[];
  ads_enabled?: boolean;
  life_capabilities?: { timetable: boolean; meal: boolean; news: boolean };
};
export type ResourceContext = {
  school_id: string;
  school: ResourceSchool;
  type: "MEMBERSHIP" | "GUEST";
  membership_id?: string;
  resources: SchoolResource[];
  expires_at: string | null;
  can_administer: boolean;
};
export type ResourceAccess = {
  school_id: string;
  legacy_cbsh_access: boolean;
  context_type: "MEMBERSHIP" | "GUEST" | null;
  expires_at: string | null;
  server_time: string;
  resources: Record<Exclude<SchoolResource, "ai">, boolean> & { ai?: boolean };
  reasons: Partial<Record<SchoolResource, string>>;
};
export type ResourceContexts = {
  items: ResourceContext[];
  current_school_id: string | null;
  server_time: string;
};
export function serverTimestamp(value: string) {
  const n = Date.parse(value);
  if (!Number.isFinite(n))
    throw Error("자원 권한의 서버 시각을 확인하지 못했어요.");
  return n;
}
export function validResourceContexts(value: ResourceContexts) {
  serverTimestamp(value.server_time);
  if (
    !Array.isArray(value.items) ||
    value.items.length > 500 ||
    !(
      value.current_school_id === null ||
      typeof value.current_school_id === "string"
    )
  )
    throw Error("이용 가능한 학교 자원을 확인하지 못했어요.");
  for (const context of value.items) {
    if (
      !context ||
      (context.type === "GUEST" && context.membership_id !== undefined) ||
      (context.type === "MEMBERSHIP" &&
        typeof context.membership_id !== "string") ||
      context.school_id !== context.school?.id ||
      !/^[-A-Za-z0-9_]{1,100}$/.test(context.school_id) ||
      typeof context.school.display_name !== "string" ||
      !Array.isArray(context.school.features) ||
      !["MEMBERSHIP", "GUEST"].includes(context.type) ||
      !Array.isArray(context.resources) ||
      context.resources.some((id) => !RESOURCE_IDS.includes(id)) ||
      (context.type === "GUEST" &&
        (context.can_administer !== false || !context.expires_at)) ||
      (context.expires_at !== null &&
        !Number.isFinite(Date.parse(context.expires_at)))
    )
      throw Error("학교 자원 이용 범위를 확인하지 못했어요.");
  }
  return value;
}
export function resourceLeaseActive(expires: string | null, serverNow: number) {
  return (
    expires === null ||
    (Number.isFinite(Date.parse(expires)) && Date.parse(expires) > serverNow)
  );
}
export function resourceAllowed(
  context: ResourceContext | null,
  proof: ResourceAccess | null,
  resource: SchoolResource,
  serverNow: number,
) {
  return (
    !!context &&
    !!proof &&
    proof.school_id === context.school_id &&
    proof.context_type === context.type &&
    context.resources.includes(resource) &&
    proof.resources?.[resource] === true &&
    resourceLeaseActive(context.expires_at, serverNow) &&
    resourceLeaseActive(proof.expires_at, serverNow)
  );
}
export function resourceReason(reason?: string) {
  return (
    (
      {
        NOT_CONFIGURED: "이 학교에는 아직 해당 자원이 연결되지 않았어요.",
        FEATURE_DISABLED: "이 학교에서 현재 해당 기능을 제공하지 않아요.",
        NOT_GRANTED: "승인된 자원 이용 범위에 포함되지 않아요.",
        NO_CONTEXT: "이용할 학교 또는 승인된 임시 자원 이용을 선택해주세요.",
        SCHOOL_UNAVAILABLE: "학교 자원을 현재 이용할 수 없어요.",
      } as Record<string, string>
    )[reason || ""] || "현재 학교 자원 이용 권한을 확인하지 못했어요."
  );
}
