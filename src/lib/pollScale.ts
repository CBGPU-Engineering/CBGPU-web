/** UI-only scale interpretation. Never allocate controls from an unchecked legacy range. */
export type PollScaleRange =
  | { valid: true; min: number; max: number; compact: boolean; preview: number[] }
  | { valid: false };

export function pollScaleRange(config: unknown = {}): PollScaleRange {
  if (config !== null && (typeof config !== 'object' || Array.isArray(config))) return { valid: false };
  const bounds = (config || {}) as { min?: unknown; max?: unknown };
  const min = bounds.min === undefined ? 1 : bounds.min;
  const max = bounds.max === undefined ? 5 : bounds.max;
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return { valid: false };
  const start = BigInt(min), span = BigInt(max) - start;
  const compact = span < BigInt(7), count = compact ? Number(span) + 1 : 7;
  const preview = Array.from({ length: count }, (_, index) => count === 1 ? min : Number(start + span * BigInt(index) / BigInt(count - 1)));
  return { valid: true, min, max, compact, preview };
}

export function blankScaleAnswer(value: unknown) {
  return value === null || value === undefined || typeof value === 'string' && !value.trim();
}

export function pollScaleNumber(value: unknown, range: PollScaleRange): number | null {
  if (!range.valid || blankScaleAnswer(value) || typeof value !== 'number' && typeof value !== 'string') return null;
  // Keep legacy integer strings, without rounding a decimal string into a different integer.
  if (typeof value === 'string' && !/^[+-]?\d+$/.test(value.trim())) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number >= range.min && number <= range.max ? number : null;
}

export function pollScaleSummary(values: unknown[], range: PollScaleRange) {
  let blank = 0, invalid = 0, sum = BigInt(0), count = 0;
  const distribution = new Map<number, number>();
  for (const value of values) {
    if (blankScaleAnswer(value)) { blank++; continue; }
    const number = pollScaleNumber(value, range);
    if (number === null) { invalid++; continue; }
    count++;
    sum += BigInt(number);
    distribution.set(number, (distribution.get(number) || 0) + 1);
  }
  let average = '-';
  if (count) {
    // Sum integers exactly, then round once to the displayed decimal place.
    const denominator = BigInt(count), absolute = sum < BigInt(0) ? -sum : sum, scaled = absolute * BigInt(10);
    let rounded = scaled / denominator;
    if (scaled % denominator * BigInt(2) >= denominator) rounded++;
    average = `${sum < BigInt(0) && rounded !== BigInt(0) ? '-' : ''}${rounded / BigInt(10)}.${rounded % BigInt(10)}`;
  }
  return { count, blank, invalid, average, distribution: [...distribution].sort(([a], [b]) => a - b).map(([value, count]) => ({ value, count })) };
}
