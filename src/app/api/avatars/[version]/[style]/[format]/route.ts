import { NextRequest, NextResponse } from 'next/server';
import { createAvatarProxy, parseAvatarRequest } from '@/lib/avatarProxy';

export const dynamic = 'force-dynamic';
const proxy = createAvatarProxy();

/** Public by design: it serves only deterministic default avatars for opaque seeds and nothing account-specific. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ version: string; style: string; format: string }> }) {
  const { version, style, format } = await params;
  const parsed = parseAvatarRequest(version, style, format, request.nextUrl.searchParams);
  if ('error' in parsed) return new NextResponse(parsed.error, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const reply = await proxy.serve(parsed, ip);
  return new NextResponse(reply.body as BodyInit, { status: reply.status, headers: reply.headers });
}
