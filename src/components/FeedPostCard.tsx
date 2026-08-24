import { ChevronRight, Download } from 'lucide-react';
import type { ReportEntry } from '@/hooks/useSiteReport';
import { TYPE_ICON, TYPE_LABEL, TYPE_COLOR_VAR } from '@/components/CategoryRow';
import { formatFeedDate } from '@/lib/feedDate';
import { downloadFile } from '@/lib/utils';

interface FeedPostCardProps {
  entry: ReportEntry;
  onClick: () => void;
}


// One "post" = one log entry, styled like a social feed item: category
// badge up top (who/what this is), caption text, then photos right
// underneath it - inline, not hidden behind a tap, which is the whole
// point of this view vs. the old grouped-popover Site Report. Multi-photo
// diary entries (entry.images) get a small grid; single-photo entries
// (entry.imageUrl) get one full-width photo, same as a normal feed post
// with one attached image.
export function FeedPostCard({ entry, onClick }: FeedPostCardProps) {
  const Icon = TYPE_ICON[entry.type];
  const colorVar = `var(--${TYPE_COLOR_VAR[entry.type]})`;
  const photos = entry.images?.length ? entry.images : entry.imageUrl ? [entry.imageUrl] : [];

  const download = (url: string, i: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(url, `${entry.type}-${entry.id}${photos.length > 1 ? `-${i + 1}` : ''}.jpg`);
  };

  return (
    // A <div> acting as the whole-card button, not a real <button> - the
    // per-photo download control below is a real <button>, and nesting
    // <button> inside <button> is invalid HTML (and makes click bubbling
    // unpredictable). role="button" keeps this keyboard/AT accessible.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className="w-full text-left card-industrial p-4 space-y-3 hover:brightness-105 transition-[filter] cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="p-2 rounded-lg flex-shrink-0"
            style={{ backgroundColor: `hsl(${colorVar} / 0.15)` }}
          >
            <Icon className="w-4 h-4" style={{ color: `hsl(${colorVar})` }} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `hsl(${colorVar})` }}>
              {TYPE_LABEL[entry.type]}
            </p>
            <p className="text-[11px] text-muted-foreground">{formatFeedDate(entry.date)}</p>
          </div>
        </div>
        {entry.amount && <span className="font-bold text-sm text-foreground flex-shrink-0">{entry.amount}</span>}
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">{entry.title}</p>
        {entry.description && <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>}
      </div>

      {photos.length === 1 && (
        <div className="relative">
          <img
            src={photos[0]}
            alt={entry.title}
            className="w-full max-h-72 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={download(photos[0], 0)}
            className="absolute bottom-2 right-2 p-1.5 rounded-md bg-background/80 border border-border hover:bg-background transition-colors"
            title="Download photo"
          >
            <Download className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>
      )}
      {photos.length > 1 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.slice(0, 6).map((url, i) => (
            <div key={i} className="relative">
              <img
                src={url}
                alt={`${entry.title} — photo ${i + 1}`}
                className="w-full aspect-square object-cover rounded-md border border-border"
              />
              <button
                type="button"
                onClick={download(url, i)}
                className="absolute bottom-1 right-1 p-1 rounded-md bg-background/80 border border-border hover:bg-background transition-colors"
                title="Download photo"
              >
                <Download className="w-3 h-3 text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end text-xs text-muted-foreground gap-0.5">
        Details <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
