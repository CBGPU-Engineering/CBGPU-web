import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ message: '유튜브 검색이 아직 설정되지 않았어요.' }, { status: 503 });

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length > 100) {
    return NextResponse.json({ message: '검색어를 입력해 주세요.' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '12',
      q,
      key,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ message: 'YouTube에서 곡을 검색하지 못했어요. 잠시 후 다시 검색해 주세요.' }, { status: 502 });
    }
    const data = await res.json();
    const items = (data.items ?? [])
      .filter((item: any) => item.id?.videoId)
      .map((item: any) => ({
        videoId: item.id.videoId as string,
        title: item.snippet?.title as string,
        channelTitle: item.snippet?.channelTitle as string,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
      }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: 'YouTube 검색 결과를 확인하지 못했어요. 잠시 후 다시 검색해 주세요.' }, { status: 502 });
  }
}
