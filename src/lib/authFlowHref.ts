import { safeAuthReturn } from './authReturn.ts';
/** Carry navigation context between auth screens; never carry tokens or replay actions. */
export function authFlowHref(path: string, search: string) {
  const requested = new URLSearchParams(search).get('next');
  if (!requested) return path;
  const destination = new URL(path, 'https://cbgpu.com');
  destination.searchParams.set('next', safeAuthReturn(requested));
  return destination.pathname + destination.search + destination.hash;
}
