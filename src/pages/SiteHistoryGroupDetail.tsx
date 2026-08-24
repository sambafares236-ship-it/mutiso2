import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteReport, type ReportEntry } from '@/hooks/useSiteReport';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TYPE_ICON, TYPE_LABEL, TYPE_COLOR_VAR } from '@/components/CategoryRow';
import { groupTitle, type GroupableType, type FeedGroup } from '@/lib/feedGrouping';

function formatFullDate(day: string) {
  return new Date(day).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Re-runs the same merge-and-sort useSiteReport the feed and single-entry
// detail page already use, scoped to the group's own day, then filters
// down to just this type - same "small, correct, works on reload/shared
// link" reasoning as SiteHistoryEntryDetail.
export default function SiteHistoryGroupDetail() {
  const { siteId, type, day } = useParams<{ siteId: string; type: GroupableType; day: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: entries, isLoading } = useSiteReport(siteId, day ?? '2000-01-01', day ?? '2100-01-01');
  const matching = (entries ?? []).filter((e) => e.type === type && e.date.slice(0, 10) === day);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(`/app/history/${siteId}`);
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const Icon = type ? TYPE_ICON[type] : null;
  const colorVar = type ? `var(--${TYPE_COLOR_VAR[type]})` : undefined;
  const group: FeedGroup | null =
    type && day && matching.length ? { kind: 'group', type, day, sortDate: day, entries: matching } : null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="caution-stripe w-full fixed top-0 left-0 z-10" />
      <div className="sticky top-2 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-xl text-primary">{type ? TYPE_LABEL[type] : 'DETAILS'}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : !group ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No records found for this day — they may have been removed, or the link is out of date.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              {Icon && (
                <span className="p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: `hsl(${colorVar} / 0.15)` }}>
                  <Icon className="w-5 h-5" style={{ color: `hsl(${colorVar})` }} />
                </span>
              )}
              <div>
                <p className="text-lg font-medium text-foreground">{groupTitle(group)}</p>
                <p className="text-xs text-muted-foreground">{formatFullDate(day as string)}</p>
              </div>
            </div>

            <div className="card-industrial divide-y divide-border">
              {matching.map((entry: ReportEntry) => (
                <div key={entry.id} className="p-4">
                  <p className="text-sm font-medium text-foreground">{entry.title}</p>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
                  )}
                  {entry.amount && <p className="text-sm font-semibold text-foreground mt-1">{entry.amount}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
