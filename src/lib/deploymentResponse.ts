import {userFacingError} from './userFacingError';
/** A proxy may return HTML or an empty body; never show that body to users. */
export async function deploymentResponse(response: Response): Promise<any> {
  let value: unknown;
  try { value = await response.json(); } catch { /* handled below without leaking proxy HTML */ }
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any> : null;
  if (!response.ok) {
    const message = record?.message;
    throw new Error(userFacingError(message, `배포 요청 결과를 확인하지 못했어요 (${response.status}). 프로젝트 설정과 배포 내역을 확인해 주세요.`));
  }
  if (!record) throw new Error('배포 서비스 응답을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
  return record;
}
