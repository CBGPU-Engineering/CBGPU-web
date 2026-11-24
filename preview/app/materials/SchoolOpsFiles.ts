import { MATERIALS_API_BASE } from '@/lib/materialsApi';
import { getNativeBridge } from '@/lib/nativeBridge';
import { confirmedAccountSession } from '@/lib/confirmedAccountSession';
import { supabase } from '@/lib/supabase';

export type Material = {
  id: string;
  uploader_id: string;
  title: string;
  tags: string[];
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export const materialFields = 'id,uploader_id,title,tags,file_name,content_type,size_bytes,created_at';

export async function downloadMaterial(material: Material, owner: string, current: () => boolean) {
  const { access_token: token } = await confirmedAccountSession(owner, current, () => supabase.auth.getSession());
  const bridge = getNativeBridge();
  if (bridge) {
    await bridge.downloadMaterial({ id: material.id, fileName: material.file_name, accessToken: token });
    return;
  }
  const response = await fetch(MATERIALS_API_BASE + '/materials/' + encodeURIComponent(material.id) + '/content', {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  if (!response.ok) throw Error('파일을 받지 못했어요. 다시 시도해 주세요.');
  const blob = await response.blob();
  if (!current()) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = material.file_name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function removeMaterial(material: Material, owner: string, current: () => boolean) {
  const session = await confirmedAccountSession(owner, current, () => supabase.auth.getSession());
  const response = await fetch(MATERIALS_API_BASE + '/materials/' + encodeURIComponent(material.id), {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + session.access_token },
  });
  if (!response.ok) throw Error('자료를 삭제하지 못했어요. 다시 시도해 주세요.');
}
