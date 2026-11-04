/** Decode the provider's string encoding only. Never execute third-party JavaScript. */
export function decodeComciganSource(html: string): string {
  if (html.length > 2_000_000) throw new Error('시간표 제공처 응답이 너무 큽니다');
  const decoded: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const block = match[1];
    if (!block.includes('hour-obfuscated-v2')) continue;
    const payload = block.match(/\}\)\((\[\[[\s\S]*\]\]),\s*(\d+)\);?\s*$/);
    if (!payload) throw new Error('시간표 제공처 인코딩 형식이 변경되었습니다');
    const parts: unknown = JSON.parse(payload[1]);
    const key = Number(payload[2]);
    if (!Array.isArray(parts) || parts.length > 10_000 || !Number.isSafeInteger(key)) throw new Error('잘못된 시간표 인코딩');
    let source = '';
    for (const part of parts) {
      if (!Array.isArray(part) || part.length !== 2 || ![0, 1].includes(part[0]) || typeof part[1] !== 'string') throw new Error('잘못된 시간표 인코딩');
      const [plain, value] = part as [number, string];
      if (plain) { source += value; continue; }
      if (value.length % 4 || !/^[\da-f]*$/i.test(value)) throw new Error('잘못된 시간표 인코딩');
      for (let offset = 0; offset < value.length; offset += 4) {
        source += String.fromCharCode(parseInt(value.slice(offset, offset + 4), 16) ^ ((key + (offset / 4) * 13) & 255));
      }
    }
    decoded.push(source);
  }
  return html + '\n' + decoded.join('\n');
}

export function extractComciganMetadata(html: string) {
  const source = decodeComciganSource(html);
  const search = source.match(/function\s+school_ra\s*\(\s*sc\s*\)[\s\S]{0,200}?url\s*:\s*['"]\.?(\/\d+\?[^'"\s]+)['"]/i);
  const data = source.match(/sc_data\(\s*['"](\d+_)['"]\s*,[^,]+,\s*(\d+)/);
  if (!search || !data) throw new Error('시간표 제공처의 조회 정보를 찾지 못했습니다');
  return { extractCode: search[1], scPrefix: data[1], scSuffix: data[2] };
}
