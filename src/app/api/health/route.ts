import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({status:'ok',commit:process.env.CBGPU_RELEASE_SHA||'legacy'},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}})}
