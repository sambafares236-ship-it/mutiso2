import type { ReportEntry } from '@/hooks/useSiteReport';

// Only "repeat record" types get grouped - each is fundamentally N records
// of the same kind on the same day (one row per worker/visitor/tool
// movement/material line), unlike diary/incident/defect/inspection/
// toolbox_talk/petty_cash/photo, where every entry is its own distinct
// narrative worth seeing on its own line even if there are several that day.
export type GroupableType = 'attendance' | 'visitor' | 'delivery' | 'usage' | 'tool';

const GROUPABLE_TYPES = new Set<ReportEntry['type']>(['attendance', 'visitor', 'delivery', 'usage', 'tool']);

function isGroupable(type: ReportEntry['type']): type is GroupableType {
  return GROUPABLE_TYPES.has(type);
}

export interface FeedGroup {
  kind: 'group';
  type: GroupableType;
  /** Calendar day (YYYY-MM-DD) every entry in this group shares. */
  day: string;
  /** Sort key for the merged feed - the latest timestamp among the group's entries. */
  sortDate: string;
  entries: ReportEntry[];
}

export interface FeedSingle {
  kind: 'single';
  entry: ReportEntry;
  sortDate: string;
}

export type FeedItem = FeedGroup | FeedSingle;

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

const COUNT_LABEL: Record<GroupableType, (n: number) => string> = {
  attendance: (n) => `${n} people marked present`,
  visitor: (n) => `${n} visitors logged`,
  delivery: (n) => `${n} deliveries logged`,
  usage: (n) => `${n} material usage entries`,
  tool: (n) => `${n} tool activity records`,
};

export function groupTitle(group: FeedGroup): string {
  return COUNT_LABEL[group.type](group.entries.length);
}

// Buckets by type+day regardless of adjacency in the input (entries of the
// same day can interleave with other types once everything's merged and
// sorted by exact timestamp), then re-flattens into one sorted list of
// FeedItems. A bucket only becomes a group at 2+ entries - a lone entry
// that day is indistinguishable from today's plain single-entry card.
export function groupFeedEntries(entries: ReportEntry[]): FeedItem[] {
  const buckets = new Map<string, ReportEntry[]>();
  const singles: ReportEntry[] = [];

  for (const entry of entries) {
    if (!isGroupable(entry.type)) {
      singles.push(entry);
      continue;
    }
    const key = `${entry.type}:${dayOf(entry.date)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const items: FeedItem[] = singles.map((entry) => ({ kind: 'single', entry, sortDate: entry.date }));

  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      items.push({ kind: 'single', entry: bucket[0], sortDate: bucket[0].date });
      continue;
    }
    const sortDate = bucket.reduce((latest, e) => (e.date > latest ? e.date : latest), bucket[0].date);
    items.push({ kind: 'group', type: bucket[0].type as GroupableType, day: dayOf(bucket[0].date), sortDate, entries: bucket });
  }

  return items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
}
