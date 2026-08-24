// Several ReportEntry.date values are plain date columns (e.g. diary,
// attendance, incidents - 'YYYY-MM-DD', 10 chars, no time component),
// while others are real timestamps (visitor time_in, photo/defect
// created_at, tool checked_out_at/returned_at). `new Date('2026-08-24')`
// parses as UTC midnight, so formatting a date-only value with an hour/
// minute option doesn't show "no time recorded" - it shows a fake time
// shifted by the browser's UTC offset (03:00 in Nairobi, UTC+3). This
// only ever formats a time when the source string actually carries one.
function hasTimeComponent(iso: string): boolean {
  return iso.length > 10;
}

export function formatFeedDate(iso: string, weekday: 'short' | 'long' = 'short'): string {
  const withTime = hasTimeComponent(iso);
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday,
    day: 'numeric',
    month: weekday === 'long' ? 'long' : 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  });
}
