import { trustedInternalServiceUrl } from './internalServiceUrl';

export function previewProxyTarget(
  host: string,
  method: string,
  pathname: string,
  search: string,
  configured?: string,
): URL | null {
  if (!configured || !['cbgpu.com', 'www.cbgpu.com'].includes(host) ||
      !['GET', 'HEAD'].includes(method) || !/^\/new(?:\/|$)/.test(pathname)) return null;

  const origin = trustedInternalServiceUrl(configured);
  if (origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Preview URL must be an origin');
  for (const segment of pathname.split('/')) {
    const decoded = decodeURIComponent(segment);
    if (decoded === '.' || decoded === '..' || /[%/\\\u0000-\u001f\u007f]/.test(decoded)) {
      throw new Error('Invalid preview path');
    }
  }
  origin.pathname = pathname;
  origin.search = search;
  return origin;
}
