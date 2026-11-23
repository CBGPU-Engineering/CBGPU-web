'use client';

import {Dropdown} from './dropdown';

/** Three shared, keyboard-accessible selectors keep time entry inside the app. */

interface TimePickerProps {
  /** 24h "HH:MM". */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function to12h(hhmm: string): { period: 'AM' | 'PM'; hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { period, hour, minute: m };
}

function to24h(period: 'AM' | 'PM', hour: number, minute: number): string {
  let h = hour % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const selectClass='min-h-11 min-w-0 flex-1 tabular-nums';

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const { period, hour, minute } = to12h(value);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Dropdown
        aria-label="오전/오후"
        value={period}
        disabled={disabled}
        onChange={(e) => onChange(to24h(e.target.value as 'AM' | 'PM', hour, minute))}
        className={selectClass}
      >
        <option value="AM">오전</option>
        <option value="PM">오후</option>
      </Dropdown>
      <Dropdown
        aria-label="시"
        value={hour}
        disabled={disabled}
        onChange={(e) => onChange(to24h(period, Number(e.target.value), minute))}
        className={selectClass}
      >
        {HOURS_12.map((h) => (
          <option key={h} value={h}>{h}시</option>
        ))}
      </Dropdown>
      <Dropdown
        aria-label="분"
        value={minute}
        disabled={disabled}
        onChange={(e) => onChange(to24h(period, hour, Number(e.target.value)))}
        className={selectClass}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
        ))}
      </Dropdown>
    </div>
  );
}
