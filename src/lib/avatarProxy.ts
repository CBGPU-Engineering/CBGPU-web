/**
 * Same-origin proxy/cache for the default avatar provider.
 *
 * Browsers and apps load avatars from our own domain, so the provider only ever sees this server (not each
 * student's IP address or user agent) and a provider outage cannot break pages. The URL shape mirrors the
 * provider (`/<version>/<style>/<format>?seed=<uuid>&size=<n>`), which is what lets the database switch to this
 * proxy by changing only `avatar_settings.base_url`.
 */
export const AVATAR_SIZES = [32, 48, 64, 96, 128, 192, 256, 384, 512] as const;
export const AVATAR_FORMATS = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' } as const;
type Format = keyof typeof AVATAR_FORMATS;

export const AVATAR_LIMITS = {
  fresh: 7 * 24 * 3600_000, staleIfError: 30 * 24 * 3600_000,
  entries: 4000, bytes: 96 * 1024 * 1024, maxBody: 512 * 1024, upstreamTimeout: 4000,
  missesPerIpPerMinute: 30, missesPerMinute: 600, concurrentUpstream: 8,
} as const;

export type AvatarRequest = { version: string; style: string; format: Format; seed: string; size: number };
export type AvatarReply = { status: number; headers: Record<string, string>; body: Uint8Array | string };
type Entry = { body: Uint8Array; type: string; at: number };
type Deps = { fetch: typeof fetch; now: () => number; upstream: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Only the exact shapes the database produces are accepted, so the upstream URL can never be steered. */
export function parseAvatarRequest(version: string, style: string, format: string, search: URLSearchParams): AvatarRequest | { error: string } {
  if (!/^\d{1,3}\.x$/.test(version) || !/^[a-z][a-z0-9-]{0,39}$/.test(style)) return { error: 'Unsupported avatar style' };
  if (!Object.hasOwn(AVATAR_FORMATS, format)) return { error: 'Unsupported avatar format' };
  const seed = search.get('seed') ?? '';
  if (!UUID.test(seed)) return { error: 'Invalid avatar seed' };
  const raw = search.get('size') ?? '256';
  const size = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  // Fixed sizes keep the cache small and stop size-churn from bypassing it.
  if (!AVATAR_SIZES.includes(size as (typeof AVATAR_SIZES)[number])) return { error: 'Unsupported avatar size' };
  if ([...search.keys()].some(key => key !== 'seed' && key !== 'size')) return { error: 'Unsupported avatar option' };
  return { version, style, format: format as Format, seed, size };
}

/** A local, deterministic placeholder (colour derived from the opaque seed) shown while the provider is unavailable. */
export function fallbackAvatarSvg(seed: string): string {
  let hash = 0; for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="기본 프로필"><rect width="64" height="64" fill="hsl(${hue} 55% 88%)"/><circle cx="32" cy="25" r="11" fill="hsl(${hue} 45% 55%)"/><path d="M10 64c2-15 12-22 22-22s20 7 22 22z" fill="hsl(${hue} 45% 55%)"/></svg>`;
}

export function createAvatarProxy(deps: Partial<Deps> = {}) {
  const d: Deps = { fetch: deps.fetch ?? fetch, now: deps.now ?? Date.now, upstream: deps.upstream ?? process.env.CBGPU_AVATAR_UPSTREAM ?? 'https://api.dicebear.com' };
  const cache = new Map<string, Entry>(); let cacheBytes = 0;
  const inflight = new Map<string, Promise<Entry | null>>();
  const ipMisses = new Map<string, { start: number; count: number }>();
  let globalWindow = { start: 0, count: 0 }, running = 0;

  const remember = (key: string, entry: Entry) => {
    const old = cache.get(key); if (old) { cacheBytes -= old.body.byteLength; cache.delete(key); }
    cache.set(key, entry); cacheBytes += entry.body.byteLength;
    while (cache.size > AVATAR_LIMITS.entries || cacheBytes > AVATAR_LIMITS.bytes) {
      const oldest = cache.keys().next().value as string; cacheBytes -= cache.get(oldest)!.body.byteLength; cache.delete(oldest);
    }
  };
  /** Cache misses are the only thing that costs an upstream request, so only they are limited. */
  const allowMiss = (ip: string) => {
    const now = d.now();
    if (now - globalWindow.start > 60_000) globalWindow = { start: now, count: 0 };
    const mine = ipMisses.get(ip); const slot = !mine || now - mine.start > 60_000 ? { start: now, count: 0 } : mine;
    if (ipMisses.size > 5000) ipMisses.clear();
    ipMisses.set(ip, slot);
    if (slot.count >= AVATAR_LIMITS.missesPerIpPerMinute) return 'ip' as const;
    if (globalWindow.count >= AVATAR_LIMITS.missesPerMinute || running >= AVATAR_LIMITS.concurrentUpstream) return 'busy' as const;
    slot.count++; globalWindow.count++; return 'ok' as const;
  };
  async function fetchUpstream(req: AvatarRequest): Promise<Entry | null> {
    running++;
    try {
      const url = `${d.upstream}/${req.version}/${req.style}/${req.format}?seed=${req.seed}&size=${req.size}`;
      // No cookies, no client address, no client user agent: the provider only sees this server.
      const res = await d.fetch(url, { headers: { 'User-Agent': 'CBGPU-avatar-proxy', Accept: AVATAR_FORMATS[req.format] }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(AVATAR_LIMITS.upstreamTimeout) });
      const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!res.ok || type !== AVATAR_FORMATS[req.format]) return null;
      const body = new Uint8Array(await res.arrayBuffer());
      return body.byteLength > 0 && body.byteLength <= AVATAR_LIMITS.maxBody ? { body, type, at: d.now() } : null;
    } catch { return null; } finally { running--; }
  }

  const ok = (entry: Entry, extra: Record<string, string> = {}): AvatarReply => ({
    status: 200, body: entry.body,
    headers: { 'Content-Type': entry.type, 'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", ...extra },
  });
  const placeholder = (seed: string, extra: Record<string, string> = {}): AvatarReply => ({
    status: 200, body: fallbackAvatarSvg(seed),
    // Short lifetime so the real avatar replaces it as soon as the provider is back.
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300', 'X-Avatar-Fallback': '1', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", ...extra },
  });

  return {
    cacheSize: () => cache.size,
    async serve(req: AvatarRequest, ip: string): Promise<AvatarReply> {
      const key = `${req.version}/${req.style}/${req.format}/${req.size}/${req.seed}`;
      const hit = cache.get(key), now = d.now();
      if (hit && now - hit.at < AVATAR_LIMITS.fresh) return ok(hit, { 'X-Avatar-Cache': 'hit' });
      let pending = inflight.get(key);
      if (!pending) {
        const gate = allowMiss(ip);
        if (gate === 'ip') return { status: 429, body: 'Too many avatar requests', headers: { 'Retry-After': '60', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } };
        if (gate === 'busy') return hit && now - hit.at < AVATAR_LIMITS.staleIfError ? ok(hit, { 'X-Avatar-Cache': 'stale' }) : placeholder(req.seed);
        pending = fetchUpstream(req).finally(() => inflight.delete(key)); inflight.set(key, pending);
      }
      const fresh = await pending;
      if (fresh) { remember(key, fresh); return ok(fresh, { 'X-Avatar-Cache': 'miss' }); }
      // Provider unavailable: keep showing the last good image, otherwise the local placeholder.
      return hit && now - hit.at < AVATAR_LIMITS.staleIfError ? ok(hit, { 'X-Avatar-Cache': 'stale' }) : placeholder(req.seed);
    },
  };
}
