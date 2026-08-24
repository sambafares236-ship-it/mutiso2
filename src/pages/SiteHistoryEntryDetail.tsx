import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteReport } from '@/hooks/useSiteReport';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TYPE_ICON, TYPE_LABEL, TYPE_COLOR_VAR } from '@/components/CategoryRow';
import { formatFeedDate } from '@/lib/feedDate';
import { downloadFile } from '@/lib/utils';

function daysAround(iso: string, pad: number) {
  const base = new Date(iso);
  const start = new Date(base);
  start.setDate(start.getDate() - pad);
  const end = new Date(base);
  end.setDate(end.getDate() + pad);
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}


// Rather than 12 new per-type single-row queries, this re-runs the same
// merge-and-sort useSiteReport already uses for the feed, just scoped to a
// tight ±2 day window around the entry's own date (passed via ?date= from
// the feed card's link) and picks out the one matching id. Small, correct,
// and works on a full page reload or a shared link, not just in-app
// navigation from the feed.
export default function SiteHistoryEntryDetail() {
  const { siteId, entryId } = useParams<{ siteId: string; entryId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const dateParam = searchParams.get('date');

  const { start, end } = dateParam ? daysAround(dateParam, 2) : { start: '2000-01-01', end: '2100-01-01' };
  const { data: entries, isLoading } = useSiteReport(siteId, start, end);
  const entry = entries?.find((e) => e.id === entryId);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(`/app/history/${siteId}`);
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const Icon = entry ? TYPE_ICON[entry.type] : null;
  const colorVar = entry ? `var(--${TYPE_COLOR_VAR[entry.type]})` : undefined;
  const photos = entry ? (entry.images?.length ? entry.images : entry.imageUrl ? [entry.imageUrl] : []) : [];

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="caution-stripe w-full fixed top-0 left-0 z-10" />
      <div className="sticky top-2 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-xl text-primary">ACTIVITY</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : !entry ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            This entry couldn't be found — it may have been removed, or the link is out of date.
          </p>
        ) : (
          <div className="card-industrial p-5 space-y-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <span className="p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: `hsl(${colorVar} / 0.15)` }}>
                  <Icon className="w-5 h-5" style={{ color: `hsl(${colorVar})` }} />
                </span>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `hsl(${colorVar})` }}>
                  {TYPE_LABEL[entry.type]}
                </p>
                <p className="text-xs text-muted-foreground">{formatFeedDate(entry.date, 'long')}</p>
              </div>
            </div>

            <div>
              <p className="text-lg font-medium text-foreground">{entry.title}</p>
              {entry.description && <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>}
              {entry.amount && <p className="font-bold text-foreground mt-2">{entry.amount}</p>}
            </div>

            {photos.length > 0 && (
              <div className={photos.length === 1 ? '' : 'grid grid-cols-2 gap-2'}>
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <a href={url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={url}
                        alt={`${entry.title} — photo ${i + 1}`}
                        className="w-full rounded-lg border border-border object-cover"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(url, `${entry.type}-${entry.id}${photos.length > 1 ? `-${i + 1}` : ''}.jpg`)
                      }
                      className="absolute bottom-2 right-2 p-1.5 rounded-md bg-background/80 border border-border hover:bg-background transition-colors"
                      title="Download photo"
                    >
                      <Download className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
