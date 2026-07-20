import { useMemo, useState } from 'react';
import { Package, X, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useInventory } from '@/hooks/useMaterials';
import { exportMaterialInventoryCsv } from '@/lib/csvExports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// Same threshold AtAGlanceStats/AtAGlanceDetailView already count "low stock"
// with - kept identical so the dashboard tile's number and this list can never
// disagree about which items are low.
export const LOW_STOCK_THRESHOLD = 10;

interface InventoryViewProps {
  siteId: string;
  onClose: () => void;
}

// Read-only by design, for both roles. material_inventory is derived state -
// every row is maintained by log_material_delivery()/log_material_usage(),
// so the way to correct a number is to log the delivery or usage that
// explains it, not to hand-edit the balance. A manual stock-take adjustment
// would need its own RPC and audit trail; see ISSUES.md if that's wanted.
export function InventoryView({ siteId, onClose }: InventoryViewProps) {
  const { data: inventory, isLoading } = useInventory(siteId);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? (inventory ?? []).filter((item) => item.material_name.toLowerCase().includes(term))
      : (inventory ?? []);
    // Low stock floats to the top - the whole reason a foreman opens this
    // screen is "what are we about to run out of", not alphabetical browsing.
    return [...filtered].sort((a, b) => {
      const aLow = Number(a.current_quantity) <= LOW_STOCK_THRESHOLD;
      const bLow = Number(b.current_quantity) <= LOW_STOCK_THRESHOLD;
      if (aLow !== bLow) return aLow ? -1 : 1;
      if (aLow && bLow) return Number(a.current_quantity) - Number(b.current_quantity);
      return a.material_name.localeCompare(b.material_name);
    });
  }, [inventory, search]);

  const lowCount = (inventory ?? []).filter((item) => Number(item.current_quantity) <= LOW_STOCK_THRESHOLD).length;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl text-primary">STOCK ON SITE</h2>
              <p className="text-xs text-muted-foreground">What's currently held at this site</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !inventory?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nothing in stock yet — log a delivery and it will show up here.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs text-muted-foreground">
                {inventory.length} item{inventory.length === 1 ? '' : 's'}
                {lowCount > 0 && <span className="text-destructive"> · {lowCount} low</span>}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={async () => {
                  try {
                    await exportMaterialInventoryCsv(siteId);
                    toast.success('CSV downloaded');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search material"
                className="pl-9"
              />
            </div>

            {!rows.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No material matches "{search}".</p>
            ) : (
              <div className="space-y-2">
                {rows.map((item) => {
                  const isLow = Number(item.current_quantity) <= LOW_STOCK_THRESHOLD;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 p-3 bg-card rounded-xl border ${
                        isLow ? 'border-destructive/30' : 'border-border'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{item.material_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Updated {new Date(item.last_updated).toLocaleDateString('en-KE')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-medium ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                          {item.current_quantity} {item.unit ?? ''}
                        </p>
                        {isLow && <p className="text-[10px] text-destructive">Low stock</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
