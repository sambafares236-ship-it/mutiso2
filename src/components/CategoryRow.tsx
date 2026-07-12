import { Users, Truck, Hammer, ClipboardList, Camera, AlertTriangle, HardHat, ClipboardCheck, Wrench, Cog, UserCheck, Wallet, Download } from 'lucide-react';
import type { ReportEntry } from '@/hooks/useSiteReport';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { downloadFile } from '@/lib/utils';

export const TYPE_ICON: Record<ReportEntry['type'], React.ElementType> = {
  attendance: Users,
  visitor: UserCheck,
  delivery: Truck,
  usage: Hammer,
  diary: ClipboardList,
  photo: Camera,
  incident: AlertTriangle,
  toolbox_talk: HardHat,
  inspection: ClipboardCheck,
  defect: Wrench,
  tool: Cog,
  petty_cash: Wallet,
};

export const TYPE_LABEL: Record<ReportEntry['type'], string> = {
  attendance: 'People Present',
  visitor: 'Visitors',
  delivery: 'Materials Delivered',
  usage: 'Materials Used',
  diary: 'Site Activities',
  incident: 'Incidents',
  toolbox_talk: 'Toolbox Talks',
  inspection: 'Inspections',
  defect: 'Defects',
  photo: 'Photos',
  tool: 'Tools & Equipment',
  petty_cash: 'Petty Cash',
};

// Categorical identity color per category - see the --cat-* custom
// properties in src/index.css for the full validation notes (checked with
// the dataviz skill's validator against this app's dark surface: lightness
// band, chroma floor, contrast, CVD pairwise separation). Incidents/
// Defects deliberately reuse --destructive/--accent instead of a slot
// here, since those two categories already mean "something's wrong" via
// those exact tokens everywhere else in the app.
export const TYPE_COLOR_VAR: Record<ReportEntry['type'], string> = {
  attendance: 'cat-attendance',
  visitor: 'cat-visitor',
  delivery: 'cat-delivery',
  usage: 'cat-usage',
  diary: 'cat-diary',
  toolbox_talk: 'cat-toolbox',
  inspection: 'cat-inspection',
  photo: 'cat-photo',
  tool: 'cat-tool',
  petty_cash: 'cat-petty-cash',
  incident: 'destructive',
  defect: 'accent',
};

// Operational order: who/what happened on site first, then materials
// in/out, then safety/quality records, then photos last - not just the
// order tables happen to be defined in the schema. Visitors sit right
// after attendance - both are "who was on site," just workers vs. not.
// Petty cash sits with tool/asset tracking rather than up with materials,
// since it's a cost record rather than an operational field event.
export const TYPE_ORDER: ReportEntry['type'][] = [
  'attendance',
  'visitor',
  'delivery',
  'usage',
  'diary',
  'tool',
  'petty_cash',
  'incident',
  'toolbox_talk',
  'inspection',
  'defect',
  'photo',
];

interface CategoryRowProps {
  type: ReportEntry['type'];
  entries: ReportEntry[];
  /** Compact renders icon + count only (no label text) - for tight spaces
   * like a summary card, where the popover content still spells out the
   * full category name. */
  compact?: boolean;
  /** When provided, the row becomes a plain button that calls this instead
   * of opening its own popover - used by the Overview's compact preview,
   * where tapping anything should jump into the full Site History view
   * (which can browse any date range) rather than show a small inline
   * popover of just today's entries. */
  onClick?: () => void;
}

function groupByDate(entries: ReportEntry[]) {
  const groups = new Map<string, ReportEntry[]>();
  for (const entry of entries) {
    const day = entry.date.split('T')[0];
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(entry);
  }
  return [...groups.entries()];
}

function formatDateHeader(day: string) {
  return new Date(day).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// One row = one category: a colored, clickable summary that opens a
// popover with the full entry list on click. Shared between the full
// Site Report view and the Overview page's compact history preview so
// both render identically and share one source of truth for the color
// mapping - editing the palette in one place updates both surfaces.
export function CategoryRow({ type, entries, compact = false, onClick }: CategoryRowProps) {
  const Icon = TYPE_ICON[type];
  const colorVar = `var(--${TYPE_COLOR_VAR[type]})`;

  const trigger = (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? 'flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors hover:brightness-110'
          : 'w-full flex items-center justify-between p-3 rounded-xl border transition-colors hover:brightness-110'
      }
      style={{
        borderColor: `hsl(${colorVar} / 0.35)`,
        backgroundColor: `hsl(${colorVar} / 0.08)`,
      }}
      title={TYPE_LABEL[type]}
    >
      <span className={compact ? 'flex items-center gap-1.5' : 'flex items-center gap-2.5'}>
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: `hsl(${colorVar})` }} />
        {!compact && <span className="text-sm font-medium text-foreground">{TYPE_LABEL[type]}</span>}
      </span>
      <span
        className={compact ? 'text-xs font-semibold' : 'text-xs font-semibold rounded-full px-2 py-0.5 flex-shrink-0'}
        style={compact ? { color: `hsl(${colorVar})` } : { backgroundColor: `hsl(${colorVar} / 0.2)`, color: `hsl(${colorVar})` }}
      >
        {entries.length}
      </span>
    </button>
  );

  // A navigation target was given (Overview's compact preview) - skip the
  // popover entirely and just act as a button.
  if (onClick) return trigger;

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 pb-1.5">{TYPE_LABEL[type]}</p>
        {type === 'photo' ? (
          <div className="space-y-3">
            {groupByDate(entries).map(([day, dayEntries]) => (
              <div key={day}>
                <p className="text-[10px] font-medium text-muted-foreground px-1 pb-1">{formatDateHeader(day)}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="relative group">
                      <a href={entry.imageUrl} target="_blank" rel="noreferrer" className="block aspect-square">
                        <img
                          src={entry.imageUrl}
                          alt={entry.title}
                          className="w-full h-full object-cover rounded-md border border-border hover:brightness-110 transition-[filter]"
                        />
                      </a>
                      {entry.imageUrl && (
                        <button
                          type="button"
                          onClick={() => downloadFile(entry.imageUrl as string, `${type}-${entry.id}.jpg`)}
                          className="absolute bottom-1 right-1 p-1 rounded-md bg-background/80 border border-border hover:bg-background transition-colors"
                          title="Download photo"
                        >
                          <Download className="w-3 h-3 text-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => {
              // Non-photo entries can still carry an image (e.g. a petty
              // cash receipt) - keep the thumbnail + tap-to-open-full-size
              // treatment for those, just without the photo category's
              // date-grouped grid layout.
              const Wrapper = entry.imageUrl ? 'a' : 'div';
              return (
                <Wrapper
                  key={entry.id}
                  {...(entry.imageUrl ? { href: entry.imageUrl, target: '_blank', rel: 'noreferrer' } : {})}
                  className={`flex items-center gap-3 p-2 rounded-lg bg-secondary/60 ${entry.imageUrl ? 'hover:bg-secondary transition-colors cursor-pointer' : ''}`}
                >
                  {entry.imageUrl && (
                    <img
                      src={entry.imageUrl}
                      alt={entry.title}
                      className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-border"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{entry.title}</p>
                    {entry.description && <p className="text-xs text-muted-foreground truncate">{entry.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {entry.amount && <p className="font-bold text-sm text-foreground">{entry.amount}</p>}
                    <p className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString('en-KE')}</p>
                  </div>
                </Wrapper>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
