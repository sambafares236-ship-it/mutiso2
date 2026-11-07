import { useEffect, useMemo, useState } from 'react';
import { useSiteReport, type ReportEntry } from '@/hooks/useSiteReport';
import { groupFeedEntries, type FeedItem } from '@/lib/feedGrouping';

const PAGE_SIZE = 20;

// 'all' shows every kind of entry the feed knows about; the others narrow it
// to one kind.
export type HistoryTypeFilter = 'all' | 'delivery' | 'usage' | 'attendance' | 'diary';

interface UseSiteHistoryFeedOptions {
  startDate: string;
  endDate: string;
  type: HistoryTypeFilter;
}

// useSiteReport pulls a merged, sorted feed for a fixed date range across
// all 12 log tables. The screen now picks that range (this week, last week,
// last 30 days or custom) and an optional type filter, so this hook just
// filters what came back, groups it, and reveals it a page at a time -
// there's no longer an auto-widening window to go further back; pick a
// wider period instead.
//
// Filtering happens before grouping, and grouping before pagination, so
// "Load more" always reveals a consistent number of feed cards regardless
// of how many raw records (e.g. a 20-person attendance day) collapsed into
// one of them.
export function useSiteHistoryFeed(siteId: string | undefined, { startDate, endDate, type }: UseSiteHistoryFeedOptions) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: entries, isLoading, isFetching } = useSiteReport(siteId, startDate, endDate);

  // A new period or filter starts the list from the top again.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [startDate, endDate, type]);

  const filtered = useMemo<ReportEntry[]>(
    () => (type === 'all' ? (entries ?? []) : (entries ?? []).filter((e) => e.type === type)),
    [entries, type],
  );

  const groupedItems = useMemo<FeedItem[]>(() => groupFeedEntries(filtered), [filtered]);

  const visible = groupedItems.slice(0, visibleCount);
  const hasMore = visibleCount < groupedItems.length;

  return {
    items: visible,
    totalCount: groupedItems.length,
    isLoading,
    isRefetching: isFetching && !isLoading,
    hasMore,
    loadMore: () => setVisibleCount((c) => c + PAGE_SIZE),
  };
}
