/**
 * Login storage shared by the regular CBGPU sites.
 *
 * Supabase keeps the session in localStorage by default, which is per origin, so cbgpu.com, app.cbgpu.com,
 * researcher.cbgpu.com, docs.cbgpu.com ... each asked for their own login. Regular sites use a cookie on
 * `.cbgpu.com` instead, so one login covers all of them. The admin and equipment-manager hosts keep their own
 * per-origin login on purpose (they are authenticated separately and must not see a regular-site session).
 *
 * - The session is split into small cookies (browsers cap a cookie at ~4KB).
 * - An existing localStorage session is copied into the cookie on first read, so nobody is logged out by the change.
 * - Pure functions with injected cookie/storage APIs, so they can be unit tested.
 */
export type CookieJar = { read(): string; write(cookie: string): void };
export type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SharedSessionOptions = { hostname: string; cookies: CookieJar; local: LocalStore; secure?: boolean };

const CHUNK = 1800; // raw characters per cookie; URL-encoded stays well below the 4KB cookie limit
const MAX_AGE = 60 * 60 * 24 * 365;
const ROOT = 'cbgpu.com';
// Always separately authenticated: never share their login with the regular sites.
const SEPARATE_HOSTS = new Set(['admin.cbgpu.com', 'developers.cbgpu.com']);
// Equipment hosts keep their own login only while the portal gateway is in front of them (portalGate);
// once it passes through, equipment managers sign in like everyone else.
const GATEWAY_HOSTS = new Set(['manufacturing.cbgpu.com', 'print.cbgpu.com', 'laser.cbgpu.com']);

export function isSharedSessionHost(hostname: string, portalGate = false): boolean {
  const host = hostname.toLowerCase();
  if (SEPARATE_HOSTS.has(host)) return false;
  if (GATEWAY_HOSTS.has(host)) return !portalGate;
  return host === ROOT || host.endsWith('.' + ROOT) || host === 'localhost' || host === '127.0.0.1';
}

function cookieAttributes(hostname: string, maxAge: number, secure: boolean): string {
  const host = hostname.toLowerCase();
  const domain = host === ROOT || host.endsWith('.' + ROOT) ? `; Domain=.${ROOT}` : '';
  return `; Path=/; Max-Age=${maxAge}${domain}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function readAll(jar: CookieJar): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of jar.read().split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name) continue;
    try { out.set(name, decodeURIComponent(part.slice(i + 1).trim())); } catch { /* ignore a malformed cookie */ }
  }
  return out;
}

export function createSharedSessionStorage(options: SharedSessionOptions) {
  const {hostname, cookies, local} = options;
  const secure = options.secure ?? (hostname !== 'localhost' && hostname !== '127.0.0.1');
  const write = (name: string, value: string, maxAge: number) => cookies.write(`${name}=${encodeURIComponent(value)}${cookieAttributes(hostname, maxAge, secure)}`);

  function readCookie(key: string): string | null {
    const all = readAll(cookies);
    const parts: string[] = [];
    for (let i = 0; all.has(`${key}.${i}`); i += 1) parts.push(all.get(`${key}.${i}`)!);
    return parts.length ? parts.join('') : null;
  }
  function writeCookie(key: string, value: string) {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) chunks.push(value.slice(i, i + CHUNK));
    chunks.forEach((chunk, i) => write(`${key}.${i}`, chunk, MAX_AGE));
    // Remove chunks left over from a longer previous value.
    const all = readAll(cookies);
    for (let i = chunks.length; all.has(`${key}.${i}`); i += 1) write(`${key}.${i}`, '', 0);
  }
  function removeCookie(key: string) {
    const all = readAll(cookies);
    for (let i = 0; all.has(`${key}.${i}`); i += 1) write(`${key}.${i}`, '', 0);
  }

  return {
    getItem(key: string): string | null {
      const shared = readCookie(key);
      if (shared !== null) {
        // A shared login exists: discard any older per-site copy so it can never bring a signed-out session back.
        try { if (local.getItem(key) !== null) local.removeItem(key); } catch { /* ignore */ }
        return shared;
      }
      // First visit after the change: adopt the login this browser already had on this site.
      let legacy: string | null = null;
      try { legacy = local.getItem(key); } catch { /* storage may be blocked */ }
      if (legacy) {
        writeCookie(key, legacy);
        // Drop the old copy only once the cookie really holds it; otherwise a later sign-out elsewhere
        // would be undone by this stale copy being adopted again.
        if (readCookie(key) === legacy) { try { local.removeItem(key); } catch { /* ignore */ } }
      }
      return legacy;
    },
    setItem(key: string, value: string): void {
      writeCookie(key, value);
      try { local.removeItem(key); } catch { /* ignore */ }
    },
    removeItem(key: string): void {
      removeCookie(key);
      try { local.removeItem(key); } catch { /* ignore */ }
    },
  };
}

/** Browser wiring; returns undefined when the default (localStorage) storage should be used. */
export function browserSharedSessionStorage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  if (!isSharedSessionHost(window.location.hostname, Boolean((window as {__CBGPU_PORTAL_GATE?: boolean}).__CBGPU_PORTAL_GATE))) return undefined;
  return createSharedSessionStorage({
    hostname: window.location.hostname,
    cookies: {read: () => document.cookie, write: cookie => { document.cookie = cookie; }},
    // Accessed lazily: reading window.localStorage can itself throw when storage is blocked.
    local: {getItem: k => window.localStorage.getItem(k), setItem: (k, v) => window.localStorage.setItem(k, v), removeItem: k => window.localStorage.removeItem(k)},
  });
}
