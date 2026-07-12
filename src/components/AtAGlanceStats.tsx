import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePayrollSummary } from '@/hooks/usePayroll';
import { formatKES } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AtAGlanceDetailView, type AtAGlanceDetailType } from '@/components/forms/AtAGlanceDetailView';
import { SiteReportView } from '@/components/forms/SiteReportView';

interface AtAGlanceStatsProps {
  siteId: string;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// Reuses the same three-stat pattern the old app had (deliveries/workers/
// lowStock), rebuilt against the current schema. Each tile opens a focused
// drill-down (AtAGlanceDetailView) rather than being a dead-end number -
// "Present" isn't the same shape of question as "Low stock", so each gets
// its own purpose-built view instead of forcing all three through the
// History feed's dated-event-log shape.
export function AtAGlanceStats({ siteId }: AtAGlanceStatsProps) {
  const [openDetail, setOpenDetail] = useState<AtAGlanceDetailType | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { data: payroll, isLoading: payrollLoading } = usePayrollSummary(siteId);
  const { data: stats, isLoading } = useQuery({
    queryKey: ['atAGlance', siteId, today()],
    queryFn: async () => {
      const [presentRes, deliveriesRes, inventoryRes] = await Promise.all([
        supabase
          .from('attendance_log')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('date', today()),
        supabase
          .from('materials_delivered')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('date', today()),
        supabase.from('material_inventory').select('id', { count: 'exact', head: true }).eq('site_id', siteId).lte('current_quantity', 10),
      ]);
      return {
        present: presentRes.count ?? 0,
        deliveries: deliveriesRes.count ?? 0,
        lowStock: inventoryRes.count ?? 0,
      };
    },
    enabled: !!siteId,
  });

  if (isLoading || payrollLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 mb-5">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground tracking-wide uppercase">Today at a glance</p>
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <History className="w-3.5 h-3.5" /> Full history
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpenDetail('attendance')}
          className="bg-card rounded-xl py-3 px-2 text-center border border-border hover:border-primary/50 active:scale-95 transition-all"
        >
          <p className="text-xl font-bold text-warning">{stats?.present ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Present</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenDetail('deliveries')}
          className="bg-card rounded-xl py-3 px-2 text-center border border-border hover:border-primary/50 active:scale-95 transition-all"
        >
          <p className="text-xl font-bold text-success">{stats?.deliveries ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Deliveries</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenDetail('lowStock')}
          className="bg-card rounded-xl py-3 px-2 text-center border border-border hover:border-primary/50 active:scale-95 transition-all"
        >
          <p className="text-xl font-bold text-destructive">{stats?.lowStock ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Low stock</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenDetail('payroll')}
          className="bg-card rounded-xl py-3 px-2 text-center border border-border hover:border-primary/50 active:scale-95 transition-all"
        >
          <p className="text-xl font-bold text-primary">{formatKES(payroll?.todayTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Today's Payroll</p>
        </button>
      </div>

      {openDetail && <AtAGlanceDetailView siteId={siteId} type={openDetail} onClose={() => setOpenDetail(null)} />}
      {showHistory && <SiteReportView siteId={siteId} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
