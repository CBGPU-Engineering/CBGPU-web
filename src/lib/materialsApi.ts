import { supabase } from '@/lib/supabase';

/** All browser traffic stays on the public site's HTTPS origin. */
export const MATERIALS_API_BASE = '/api/files';

export type MaterialsQuota = { used_bytes: number; quota_bytes: number; remaining_bytes: number };
export type MaterialsUsage = MaterialsQuota & {
  reserved_bytes: number; file_count: number; disk_total_bytes: number; disk_free_bytes: number;
};

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(bytes > 0 ? 1 : 0, Math.round(bytes / 1024))} KB`;
}

export async function materialsToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  return session.access_token;
}

/** 서버가 아직 이 엔드포인트를 모르는 옛 버전이면 null — 호출하는 쪽에서 조용히 넘어간다. */
export async function fetchMaterialsJson<T>(path: string): Promise<T | null> {
  const token = await materialsToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${MATERIALS_API_BASE}${path}`, { cache: 'no-store', signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404 || response.status === 405) return null;
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
      throw new Error(typeof detail === 'string' && detail.length <= 1000 ? detail : `파일 서버에 연결하지 못했어요 (${response.status}). 잠시 후 다시 확인해 주세요.`);
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('파일 서버 응답을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
    return body as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('파일 서버 응답이 늦어지고 있어요. 잠시 후 다시 확인해 주세요.');
    if (error instanceof TypeError) throw new Error('파일 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
    throw error;
  } finally { clearTimeout(timer); }
}
