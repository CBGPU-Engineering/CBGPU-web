export type SchoolLifeSources = {
  school_id: string;
  status: "READY" | "NOT_CONFIGURED" | "DISABLED";
  school_name: string;
  region: string;
  version: number;
  homepage_url: string | null;
  news_url: string | null;
  letter_url: string | null;
  calendar_url: string | null;
  meal_url: string | null;
  meal_provider: "SCHOOL_WEBSITE" | "NEIS" | null;
  allowed_hosts: string[];
  comcigan: {
    status: string;
    school_code: number | null;
    school_name: string;
    region: string;
  };
};
export const LIFE_URL_FIELDS = [
  "homepage_url",
  "news_url",
  "letter_url",
  "calendar_url",
  "meal_url",
] as const;
export type LifeDraft = {
  allowed_hosts: string;
  homepage_url: string;
  news_url: string;
  letter_url: string;
  calendar_url: string;
  meal_url: string;
  meal_provider: "" | "SCHOOL_WEBSITE" | "NEIS";
  comcigan_school_code: string;
};
export function lifeDraft(source: SchoolLifeSources): LifeDraft {
  return {
    allowed_hosts: source.allowed_hosts.join("\n"),
    homepage_url: source.homepage_url || "",
    news_url: source.news_url || "",
    letter_url: source.letter_url || "",
    calendar_url: source.calendar_url || "",
    meal_url: source.meal_url || "",
    meal_provider: source.meal_provider || "",
    comcigan_school_code: source.comcigan.school_code?.toString() || "",
  };
}
export function reviewedLifePayload(
  draft: LifeDraft,
  source: SchoolLifeSources,
  schoolId: string,
  confirmed: boolean,
) {
  if (
    !Number.isSafeInteger(source.version) ||
    source.version < 0 ||
    !confirmed ||
    source.school_id !== schoolId ||
    source.status === "DISABLED"
  )
    throw Error(
      "Load this school’s current enabled sources and confirm the independent review first.",
    );
  const hosts = [
    ...new Set(draft.allowed_hosts.split(/[\s,]+/).filter(Boolean)),
  ];
  if (
    hosts.length < 1 ||
    hosts.length > 10 ||
    hosts.some(
      (host) =>
        host !== host.toLowerCase() ||
        !/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host) ||
        /\.(local|internal|localhost|test|invalid)$/.test(host),
    )
  )
    throw Error(
      "Use 1–10 reviewed public DNS hostnames, without schemes, paths, wildcards or local names.",
    );
  const urls: Record<string, string | null> = {};
  for (const key of LIFE_URL_FIELDS) {
    const value = draft[key].trim();
    if (!value) {
      urls[key] = null;
      continue;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw Error("Enter a valid HTTPS source URL.");
    }
    if (
      value.length > 2048 ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      url.hash ||
      !hosts.includes(url.hostname) ||
      /[\u0000-\u0020\u007f\\]/.test(value)
    )
      throw Error(
        "Every source must use HTTPS and an exact reviewed host, without credentials, fragments or custom ports.",
      );
    urls[key] = value;
  }
  const code = draft.comcigan_school_code.trim();
  if (
    code &&
    (!/^[1-9]\d{0,8}$/.test(code) ||
      !source.comcigan.school_name ||
      !source.comcigan.region)
  )
    throw Error(
      "Verify the Comcigan code against this school’s canonical name and region.",
    );
  return {
    ...urls,
    expected_version: source.version,
    allowed_hosts: hosts,
    meal_provider: draft.meal_provider || null,
    comcigan_school_code: code || null,
    comcigan_school_name: source.comcigan.school_name,
    comcigan_region: source.comcigan.region,
    confirmed: true,
  };
}
