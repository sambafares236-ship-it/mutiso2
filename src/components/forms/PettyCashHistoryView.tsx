import { useQuery } from '@tanstack/react-query';
import { Wallet, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSitePettyCash, useSitePettyCashTotal } from '@/hooks/usePettyCash';
import { formatKES } from '@/lib/utils';
import { exportPettyCashCsv } from '@/lib/csvExports';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface PettyCashHistoryViewProps {
  siteId: string;
  onClose: () => void;
}

// Same private-bucket signed-URL treatment as every other receipt/photo
// in this app - fetched per-entry rather than baked into useSitePettyCash
// since only this history view needs the images (the foreman's own list
// in PettyCashForm doesn't render them).
function useReceiptUrls(siteId: string | undefined) {
  const { data: entries } = useSitePettyCash(siteId);
  return useQuery({
    queryKey: ['pettyCashReceiptUrls', siteId, entries?.map((e) => e.id).join(',')],
    queryFn: async () => {
      const withPhotos = (entries ?? []).filter((e) => e.receipt_photo_url);
      const urls = await Promise.all(
        withPhotos.map(async (e) => {
          const { data: signed } = await supabase.storage.from('site-photos').createSignedUrl(e.receipt_photo_url as string, 60 * 60);
          return [e.id, signed?.signedUrl] as const;
        }),
      );
      return Object.fromEntries(urls);
    },
    enabled: !!entries?.length,
  });
}

export function PettyCashHistoryView({ siteId, onClose }: PettyCashHistoryViewProps) {
  const { data: entries, isLoading } = useSitePettyCash(siteId);
  const { data: total, isLoading: totalLoading } = useSitePettyCashTotal(siteId);
  const { data: receiptUrls } = useReceiptUrls(siteId);

  const handleExport = async () => {
    if (!entries?.length) return;
    try {
      await exportPettyCashCsv(siteId, entries);
      toast.success('CSV downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">PETTY CASH</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="card-industrial p-4 mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total spent (project to date)</p>
          {totalLoading ? <Skeleton className="h-7 w-32 mt-1" /> : <p className="text-2xl font-bold text-foreground">{formatKES(total)}</p>}
        </div>

        {!!entries?.length && (
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : !entries?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No petty cash logged yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const receiptUrl = receiptUrls?.[entry.id];
              return (
                <div key={entry.id} className="card-industrial p-3 flex items-center gap-3">
                  {receiptUrl && (
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
                      <img src={receiptUrl} alt="Receipt" className="w-10 h-10 rounded-md object-cover border border-border hover:brightness-110" />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString('en-KE')}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground flex-shrink-0">{formatKES(entry.amount)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
