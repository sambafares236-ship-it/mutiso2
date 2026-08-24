import { ChevronRight } from 'lucide-react';
import type { FeedGroup } from '@/lib/feedGrouping';
import { groupTitle } from '@/lib/feedGrouping';
import { TYPE_ICON, TYPE_LABEL, TYPE_COLOR_VAR } from '@/components/CategoryRow';

interface GroupedFeedCardProps {
  group: FeedGroup;
  onClick: () => void;
}

function formatGroupDate(day: string) {
  return new Date(day).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Collapsed view of a same-type/same-day bucket (e.g. attendance) - a
// count-led title plus a short name/description preview, so the card still
// says something useful before it's tapped, not just "5 records".
export function GroupedFeedCard({ group, onClick }: GroupedFeedCardProps) {
  const Icon = TYPE_ICON[group.type];
  const colorVar = `var(--${TYPE_COLOR_VAR[group.type]})`;
  const previewNames = group.entries.slice(0, 3).map((e) => e.title);
  const extra = group.entries.length - previewNames.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left card-industrial p-4 space-y-3 hover:brightness-105 transition-[filter]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `hsl(${colorVar} / 0.15)` }}>
            <Icon className="w-4 h-4" style={{ color: `hsl(${colorVar})` }} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `hsl(${colorVar})` }}>
              {TYPE_LABEL[group.type]}
            </p>
            <p className="text-[11px] text-muted-foreground">{formatGroupDate(group.day)}</p>
          </div>
        </div>
        <span
          className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `hsl(${colorVar} / 0.15)`, color: `hsl(${colorVar})` }}
        >
          {group.entries.length}
        </span>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">{groupTitle(group)}</p>
        <p className="text-sm text-muted-foreground mt-0.5 truncate">
          {previewNames.join(', ')}
          {extra > 0 && ` +${extra} more`}
        </p>
      </div>

      <div className="flex items-center justify-end text-xs text-muted-foreground gap-0.5">
        Details <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}
