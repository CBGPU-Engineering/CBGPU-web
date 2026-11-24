import { safeAuthReturn } from '@/lib/authReturn';

export const accountConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function previewReturn(value: unknown) {
  const target = safeAuthReturn(value, '/new/');
  const pathname = new URL(target, 'https://cbgpu.com').pathname;
  return pathname === '/new' || pathname.startsWith('/new/') && !pathname.startsWith('/new/auth/')
    ? target
    : '/new/';
}
