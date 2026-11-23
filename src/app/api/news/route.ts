import { NextRequest, NextResponse } from 'next/server';
import { boundedSchoolBody } from '@/lib/schoolsProxySecurity';

export const dynamic = 'force-dynamic';
const responseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const MAX_FEED_BYTES = 1_048_576;

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function extractCDATA(tag: string, xml: string): string {
  return (
    xml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] ||
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ||
    ''
  ).trim();
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const rawTitle = extractCDATA('title', block);
    // Google News appends " - Source Name" — strip it
    const title = rawTitle.replace(/\s+[-–]\s+[^-–]{1,60}$/, '').trim() || rawTitle;
    const link = extractCDATA('link', block) ||
                 block.match(/<link\/>(.*?)</)?.[1]?.trim() || '';
    const pubDate = extractCDATA('pubDate', block);
    const source = extractCDATA('source', block) ||
                   rawTitle.match(/\s+[-–]\s+([^-–]{1,60})$/)?.[1]?.trim() || '';
    if (title && link) items.push({ title, link, pubDate, source });
  }
  return items;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'artificial intelligence';
  const hl = searchParams.get('hl') || 'en-US';

  try {
    const rssUrl = new URL('https://news.google.com/rss/search');
    rssUrl.search = new URLSearchParams({ q, hl, gl: 'US', ceid: 'US:en', num: '50' }).toString();

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      next: { revalidate: 300 },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });

    const mime = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!res.ok || mime && !['application/rss+xml', 'application/xml', 'text/xml'].includes(mime) || Number(res.headers.get('content-length') || 0) > MAX_FEED_BYTES) {
      void res.body?.cancel().catch(() => {});
      throw new Error('News feed unavailable');
    }
    const xml = await boundedSchoolBody(res.body, MAX_FEED_BYTES);
    // A challenge/error page or truncated feed is an outage, not zero matches.
    if (!/^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<rss(?:\s|>)/i.test(xml) || !/<channel(?:\s|>)/i.test(xml) || !/<\/channel>\s*<\/rss>\s*$/i.test(xml)) throw new Error('Invalid RSS envelope');
    const items = parseRSS(xml);
    if (/<item(?:\s|>)/i.test(xml) && !items.length) throw new Error('News items unavailable');
    return NextResponse.json({ items }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ items: [], error: '뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 502, headers: responseHeaders });
  }
}
