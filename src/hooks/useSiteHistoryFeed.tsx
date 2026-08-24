import { useEffect, useMemo, useRef, useState } from 'react';
import { useSiteReport, type ReportEntry } from '@/hooks/useSiteReport';

const PAGE_SIZE = 20;
const INITIAL_WINDOW_DAYS = 30;
const WINDOW_STEP_DAYS = 60;
const MAX_WINDOW_DAYS = 3650; // ~10 years - a hard ceiling so widening can't run forever

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// useSiteReport pulls a merged, sorted feed for a fixed date range across
// all 12 log tables - there's no single table to run a real cursor/offset
// query against. This wraps it with two layers of "Load More" instead of
// a new paginated backend query:
//   1. Reveal more of what's already been fetched for the current window
//      (cheap, no network).
//   2. Once everything fetched has been revealed, widen the date window
//      and refetch further into the past.
// Both happen behind the same button - the caller doesn't need to know
// which layer fired. Widening stops once a widen attempt turns up no new
// entries (site's history genuinely ends there) or the window hits the
// 10-year ceiling, whichever comes first - otherwise a young site would
// show a live "Load More" button that just re-fetches emptiness forever.
export function useSiteHistoryFeed(siteId: string | undefined) {
  const [windowDays, setWindowDays] = useState(INITIAL_WINDOW_DAYS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [exhausted, setExhausted] = useState(false);
  const pendingWidenFrom = useRef<number | null>(null);

  const startDate = daysAgo(windowDays);
  const endDate = daysAgo(0);

  const { data: entries, isLoading, isFetching } = useSiteReport(siteId, startDate, endDate);

  const sorted = useMemo<ReportEntry[]>(
    () => [...(entries ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  // A widen was in flight and has now resolved - check whether it actually
  // turned up anything new before allowing another one.
  useEffect(() => {
    if (isFetching || pendingWidenFrom.current === null) return;
    if (sorted.length <= pendingWidenFrom.current) setExhausted(true);
    pendingWidenFrom.current = null;
  }, [isFetching, sorted.length]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length || (!exhausted && windowDays < MAX_WINDOW_DAYS);

  const loadMore = () => {
    if (visibleCount < sorted.length) {
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    if (exhausted || windowDays >= MAX_WINDOW_DAYS) return;
    pendingWidenFrom.current = sorted.length;
    setWindowDays((d) => Math.min(d + WINDOW_STEP_DAYS, MAX_WINDOW_DAYS));
    setVisibleCount((c) => c + PAGE_SIZE);
  };

  return {
    entries: visible,
    isLoading,
    isLoadingMore: isFetching && !isLoading,
    hasMore,
    loadMore,
  };
}
