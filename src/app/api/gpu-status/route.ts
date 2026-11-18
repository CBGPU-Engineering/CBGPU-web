import { NextResponse } from 'next/server';
import { fetchGpuEndpoints, type GpuEndpoint } from '@/lib/gpuEndpoints';

export const dynamic = 'force-dynamic';

type Status = 'online' | 'offline' | 'unknown';

// The notebook gateway answers signed-out requests with 401 by design, so the public address cannot prove a GPU is up.
// The server reaches the GPU host over the private network: any HTTP answer below 500 (a Jupyter login redirect counts)
// means the notebook server is running. Only private addresses are probed from here.
const PRIVATE_HOST = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)$/;

async function probe(url: string): Promise<number | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(url, { method: 'GET', signal: ac.signal, redirect: 'manual' });
    return r.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function check(g: GpuEndpoint): Promise<Status> {
  if (PRIVATE_HOST.test(g.internal_host)) {
    const status = await probe(`http://${g.internal_host}:${g.internal_port}/`);
    if (status !== null) return status < 500 ? 'online' : 'offline';
  }
  // Private network unreachable (for example a copy running elsewhere): fall back to the public address.
  const status = await probe(g.public_url);
  if (status === null || status >= 500) return 'offline';
  if (status === 401 || status === 403) return 'unknown'; // the gateway answered but needs a sign-in, so the GPU state is not known
  return 'online';
}

export async function GET() {
  const endpoints = await fetchGpuEndpoints();
  const results = await Promise.all(
    endpoints.map(async g => ({ id: g.gpu_id, status: await check(g), url: g.public_url }))
  );
  return NextResponse.json({ gpus: results, checkedAt: new Date().toISOString() });
}
