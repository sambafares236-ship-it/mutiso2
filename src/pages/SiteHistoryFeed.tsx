import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, History, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteHistoryFeed } from '@/hooks/useSiteHistoryFeed';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedPostCard } from '@/components/FeedPostCard';

// Site's `sites` row is RLS-protected by owns_site()/is_assigned_foreman()
// same as every other site-scoped table, so a plain select here already
// naturally returns nothing for a site this user can't access - no
// separate authorization check needed beyond that.
function useSiteName(siteId: string | undefined) {
  return useQuery({
    queryKey: ['siteName', siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data } = await supabase.from('sites').select('site_name').eq('id', siteId).maybeSingle();
      return data?.site_name ?? null;
    },
    enabled: !!siteId,
  });
}

export default function SiteHistoryFeed() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: siteName } = useSiteName(siteId);
  const { entries, isLoading, isLoadingMore, hasMore, loadMore } = useSiteHistoryFeed(siteId);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/app');
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="caution-stripe w-full fixed top-0 left-0 z-10" />
      <div className="sticky top-2 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="p-2 bg-primary/20 rounded-lg">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl text-primary leading-tight">SITE HISTORY</h1>
            {siteName && <p className="text-xs text-muted-foreground truncate">{siteName}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : !entries.length ? (
          <p className="text-sm text-muted-foreground text-center py-12">No activity recorded yet.</p>
        ) : (
          <>
            {entries.map((entry) => (
              <FeedPostCard
                key={entry.id}
                entry={entry}
                onClick={() =>
                  navigate(
                    `/app/history/${siteId}/entry/${entry.id}?date=${encodeURIComponent(entry.date)}`,
                  )
                }
              />
            ))}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
