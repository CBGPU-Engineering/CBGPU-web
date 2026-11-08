import { NextRequest, NextResponse } from 'next/server';
import { getTimetable } from '@/lib/comcigan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const grade  = parseInt(sp.get('grade') || '1');
  const cls    = parseInt(sp.get('class') || '1');
  if (!Number.isInteger(grade) || grade < 1 || grade > 3 || !Number.isInteger(cls) || cls < 1 || cls > 20) {
    return NextResponse.json({ error: '학년과 반을 확인해주세요.' }, { status: 400 });
  }
  const forceRefresh = sp.get('refresh') === '1';

  try {
    const result = await getTimetable(grade, cls, { forceRefresh });
    return NextResponse.json({
      grid:    result.grid,
      times:   result.classTimes,
      grades:  result.grades,
      classes: result.classes,
      school:  result.schoolName,
      stale:result.stale,fetchedAt:result.fetchedAt,weekStart:result.weekStart,
    }, {headers:{"Cache-Control":"no-store"}});
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
