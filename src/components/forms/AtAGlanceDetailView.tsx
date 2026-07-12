import { useQuery } from '@tanstack/react-query';
import { X, Users, Truck, PackageX, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type AtAGlanceDetailType = 'attendance' | 'deliveries' | 'lowStock' | 'payroll';

interface AtAGlanceDetailViewProps {
  siteId: string;
  type: AtAGlanceDetailType;
  onClose: () => void;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

const CONFIG: Record<AtAGlanceDetailType, { title: string; icon: typeof Users; empty: string }> = {
  attendance: { title: "TODAY'S ATTENDANCE", icon: Users, empty: 'No one marked present today yet.' },
  deliveries: { title: "TODAY'S DELIVERIES", icon: Truck, empty: 'No deliveries logged today yet.' },
  lowStock: { title: 'LOW STOCK', icon: PackageX, empty: 'Nothing at or below the low-stock threshold.' },
  payroll: { title: "TODAY'S PAYROLL", icon: Banknote, empty: 'No one marked present today yet.' },
};

// One shared drill-down for all three At-a-Glance stats rather than three
// near-duplicate overlays - each just needs a different query and a
// different row renderer, the shell (header/loading/empty state) is
// identical across all three.
export function AtAGlanceDetailView({ siteId, type, onClose }: AtAGlanceDetailViewProps) {
  const { title, icon: Icon, empty } = CONFIG[type];

  const { data, isLoading } = useQuery({
    queryKey: ['atAGlanceDetail', type, siteId, today()],
    queryFn: async () => {
      if (type === 'attendance') {
        const { data, error } = await supabase
          .from('attendance_log')
          .select('id, worker:workers_master(full_name, trade)')
          .eq('site_id', siteId)
          .eq('date', today());
        if (error) throw error;
        return data;
      }
      if (type === 'deliveries') {
        const { data, error } = await supabase
          .from('materials_delivered')
          .select('*')
          .eq('site_id', siteId)
          .eq('date', today())
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      }
      if (type === 'payroll') {
        // Same "who's present today" query the live Today's Payroll total
        // is computed from (usePayrollSummary) - this is the per-worker
        // breakdown behind that one number. Foreman-readable: daily_rate
        // is already blanket owner+foreman on workers_master.
        const { data, error } = await supabase
          .from('attendance_log')
          .select('id, worker:workers_master(full_name, trade, daily_rate)')
          .eq('site_id', siteId)
          .eq('date', today());
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('material_inventory')
        .select('*')
        .eq('site_id', siteId)
        .lte('current_quantity', 10)
        .order('current_quantity', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-primary">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
        ) : (
          <div className="space-y-2">
            {type === 'attendance' &&
              (data as { id: string; worker: { full_name: string; trade: string | null } | null }[]).map((row) => (
                <div key={row.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border">
                  <p className="font-medium text-sm text-foreground">{row.worker?.full_name ?? 'Unknown worker'}</p>
                  {row.worker?.trade && <span className="text-xs text-muted-foreground">{row.worker.trade}</span>}
                </div>
              ))}

            {type === 'deliveries' &&
              (
                data as {
                  id: string;
                  material_name: string;
                  quantity: number;
                  unit: string | null;
                  supplier: string | null;
                }[]
              ).map((row) => (
                <div key={row.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border">
                  <div>
                    <p className="font-medium text-sm text-foreground">{row.material_name}</p>
                    {row.supplier && <p className="text-xs text-muted-foreground">{row.supplier}</p>}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {row.quantity} {row.unit ?? ''}
                  </p>
                </div>
              ))}

            {type === 'lowStock' &&
              (data as { id: string; material_name: string; current_quantity: number; unit: string | null }[]).map((row) => (
                <div key={row.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-destructive/20">
                  <p className="font-medium text-sm text-foreground">{row.material_name}</p>
                  <p className="text-sm font-medium text-destructive">
                    {row.current_quantity} {row.unit ?? ''} left
                  </p>
                </div>
              ))}

            {type === 'payroll' &&
              (
                data as {
                  id: string;
                  worker: { full_name: string; trade: string | null; daily_rate: number | null } | null;
                }[]
              ).map((row) => (
                <div key={row.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border">
                  <div>
                    <p className="font-medium text-sm text-foreground">{row.worker?.full_name ?? 'Unknown worker'}</p>
                    {row.worker?.trade && <p className="text-xs text-muted-foreground">{row.worker.trade}</p>}
                  </div>
                  <p className="text-sm font-medium text-primary">{formatKES(row.worker?.daily_rate)}</p>
                </div>
              ))}
          </div>
        )}

        {type === 'payroll' && !!data?.length && (
          <div className="flex items-center justify-between p-3 mt-3 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">
              {formatKES(
                (data as unknown as { worker: { daily_rate: number | null } | null }[]).reduce(
                  (sum, r) => sum + Number(r.worker?.daily_rate ?? 0),
                  0,
                ),
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
