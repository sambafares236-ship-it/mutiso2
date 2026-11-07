// Period presets for Site History. All dates are local calendar dates
// (YYYY-MM-DD) - not toISOString(), which converts to UTC and shifts the
// day for anyone east of Greenwich (Kenya is UTC+3, so "today" would read
// as yesterday for the first three hours of the day).

export type PeriodPreset = 'thisWeek' | 'lastWeek' | 'last30' | 'custom';

// The feed merges ~12 tables over the range in the browser; keep a single
// view bounded so it stays fast. Wider windows can be viewed in pieces.
export const MAX_VIEW_DAYS = 90;

export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toLocalDate(dt);
}

export function today(): string {
  return toLocalDate(new Date());
}

// Monday of the week containing `date` (weeks run Mon-Sun, same as payroll).
function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7; // Mon=0 ... Sun=6
  dt.setDate(dt.getDate() - offset);
  return toLocalDate(dt);
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function resolvePeriod(preset: PeriodPreset, customStart: string, customEnd: string): DateRange {
  const t = today();
  if (preset === 'thisWeek') return { startDate: mondayOf(t), endDate: t };
  if (preset === 'lastWeek') {
    const thisMonday = mondayOf(t);
    return { startDate: addDays(thisMonday, -7), endDate: addDays(thisMonday, -1) };
  }
  if (preset === 'last30') return { startDate: addDays(t, -29), endDate: t };

  // Custom: keep start <= end, never in the future, and within the view cap
  // (the later date wins; the earlier one is pulled in if the span is too wide).
  const end = customEnd > t ? t : customEnd;
  let start = customStart > end ? end : customStart;
  const earliest = addDays(end, -(MAX_VIEW_DAYS - 1));
  if (start < earliest) start = earliest;
  return { startDate: start, endDate: end };
}

export function formatRangeLabel({ startDate, endDate }: DateRange): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}
