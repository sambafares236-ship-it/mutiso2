import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_VIEW_DAYS, addDays, resolvePeriod, toLocalDate } from './historyPeriod';

// Saturday 7 Nov 2026 (the week runs Mon 2 Nov - Sun 8 Nov)
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 7, 9, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe('resolvePeriod', () => {
  it('this week runs Monday to today', () => {
    expect(resolvePeriod('thisWeek', '', '')).toEqual({ startDate: '2026-11-02', endDate: '2026-11-07' });
  });

  it('this week on a Monday is just that day', () => {
    vi.setSystemTime(new Date(2026, 10, 2, 8, 0, 0));
    expect(resolvePeriod('thisWeek', '', '')).toEqual({ startDate: '2026-11-02', endDate: '2026-11-02' });
  });

  it('this week on a Sunday still starts the previous Monday', () => {
    vi.setSystemTime(new Date(2026, 10, 8, 8, 0, 0));
    expect(resolvePeriod('thisWeek', '', '')).toEqual({ startDate: '2026-11-02', endDate: '2026-11-08' });
  });

  it('last week is the full previous Monday-Sunday', () => {
    expect(resolvePeriod('lastWeek', '', '')).toEqual({ startDate: '2026-10-26', endDate: '2026-11-01' });
  });

  it('last 30 days includes today (30 calendar days)', () => {
    expect(resolvePeriod('last30', '', '')).toEqual({ startDate: '2026-10-09', endDate: '2026-11-07' });
  });

  it('custom passes a valid range through', () => {
    expect(resolvePeriod('custom', '2026-10-01', '2026-10-15')).toEqual({ startDate: '2026-10-01', endDate: '2026-10-15' });
  });

  it('custom never reaches into the future', () => {
    expect(resolvePeriod('custom', '2026-11-01', '2026-12-31').endDate).toBe('2026-11-07');
  });

  it('custom with start after end collapses to the end date', () => {
    expect(resolvePeriod('custom', '2026-11-05', '2026-11-03')).toEqual({ startDate: '2026-11-03', endDate: '2026-11-03' });
  });

  it('custom wider than the cap keeps the end and pulls the start in', () => {
    const r = resolvePeriod('custom', '2025-01-01', '2026-11-07');
    expect(r.endDate).toBe('2026-11-07');
    expect(r.startDate).toBe(addDays('2026-11-07', -(MAX_VIEW_DAYS - 1)));
  });
});

describe('toLocalDate', () => {
  it('uses the local calendar day, not UTC', () => {
    // 01:30 local on the 7th is still the 7th even though UTC may be the 6th
    expect(toLocalDate(new Date(2026, 10, 7, 1, 30))).toBe('2026-11-07');
  });
});
