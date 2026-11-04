/** Development site origins are configuration; production links stay canonical. */
export function siteHref(href: string): string {
  if (process.env.NODE_ENV !== 'development' || !process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS) return href;
  try {
    const url = new URL(href);
    const origins: Record<string, string> = JSON.parse(process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS);
    const origin = origins[url.hostname];
    return origin ? origin + url.pathname + url.search + url.hash : href;
  } catch { return href; }
}
