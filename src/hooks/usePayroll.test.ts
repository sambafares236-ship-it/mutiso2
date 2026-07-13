import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { mondayOfThisWeek, sundayOfThisWeek } from './usePayroll';

// Payroll is generated per-week (generate_payroll_run(site, week_start,
// week_end)), so getting the week boundary wrong on any day of the week -
// especially Sunday, where JS's Date.getDay() returns 0 rather than 7 -
// would silently generate a run for the wrong week. Pins the system clock
// to each day of a known week rather than relying on "today", since the
// unpinned version only ever exercises whatever day the test happens to run.
describe('mondayOfThisWeek / sundayOfThisWeek', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const cases: Array<[string, string]> = [
    ['2026-07-06', 'Monday'],
    ['2026-07-07', 'Tuesday'],
    ['2026-07-08', 'Wednesday'],
    ['2026-07-09', 'Thursday'],
    ['2026-07-10', 'Friday'],
    ['2026-07-11', 'Saturday'],
    ['2026-07-12', 'Sunday'],
  ];

  it.each(cases)('from %s (%s), resolves to Monday 2026-07-06 through Sunday 2026-07-12', (date) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${date}T12:00:00`));

    expect(mondayOfThisWeek()).toBe('2026-07-06');
    expect(sundayOfThisWeek()).toBe('2026-07-12');
  });
});
