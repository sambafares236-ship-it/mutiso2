import { useState } from 'react';
import { History, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteReport, type ReportEntry } from '@/hooks/useSiteReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryRow, TYPE_ORDER } from '@/components/CategoryRow';
import {
  exportAttendanceCsv,
  exportMaterialsDeliveredCsv,
  exportMaterialsUsedCsv,
  exportSiteDiaryCsv,
} from '@/lib/csvExports';

// Only categories with a real CSV export defined get the export button -
// see src/lib/csvExports.ts. Others (photos, incidents, etc.) don't have
// one yet.
const EXPORTERS: Partial<Record<ReportEntry['type'], (siteId: string, start: string, end: string) => Promise<void>>> = {
  attendance: exportAttendanceCsv,
  delivery: exportMaterialsDeliveredCsv,
  usage: exportMaterialsUsedCsv,
  diary: exportSiteDiaryCsv,
};

interface SiteReportViewProps {
  siteId: string;
  onClose: () => void;
  /** Categories to leave out of this view entirely - e.g. the
   * contractor's Overview excludes 'defect' since it now has its own
   * dedicated Defects card with richer detail (both photos, verify
   * action) than the generic history feed shows. */
  excludeTypes?: ReportEntry['type'][];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

type RangeMode = 'today' | 7 | 30 | 'custom';

export function SiteReportView({ siteId, onClose, excludeTypes = [] }: SiteReportViewProps) {
  const [mode, setMode] = useState<RangeMode>(7);
  const [customStart, setCustomStart] = useState(daysAgo(7));
  const [customEnd, setCustomEnd] = useState(daysAgo(0));

  const { startDate, endDate } =
    mode === 'today'
      ? { startDate: daysAgo(0), endDate: daysAgo(0) }
      : mode === 'custom'
        ? { startDate: customStart, endDate: customEnd }
        : { startDate: daysAgo(mode), endDate: daysAgo(0) };

  const { data: entries, isLoading } = useSiteReport(siteId, startDate, endDate);

  const handleExport = async (type: ReportEntry['type']) => {
    const exporter = EXPORTERS[type];
    if (!exporter) return;
    try {
      await exporter(siteId, startDate, endDate);
      toast.success('CSV downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  };

  const groups = TYPE_ORDER.filter((type) => !excludeTypes.includes(type))
    .map((type) => ({
      type,
      entries: entries?.filter((e) => e.type === type) ?? [],
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <History className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">SITE REPORT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant={mode === 'today' ? 'construction' : 'outline'} onClick={() => setMode('today')}>
            Today
          </Button>
          {[7, 30].map((n) => (
            <Button key={n} size="sm" variant={mode === n ? 'construction' : 'outline'} onClick={() => setMode(n as RangeMode)}>
              Last {n} days
            </Button>
          ))}
          <Button size="sm" variant={mode === 'custom' ? 'construction' : 'outline'} onClick={() => setMode('custom')}>
            Custom
          </Button>
        </div>

        {mode === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={customEnd} min={customStart} max={daysAgo(0)} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : !groups.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity in this period.</p>
        ) : (
          <div className="space-y-2">
            {groups.map(({ type, entries: groupEntries }) => (
              <CategoryRow
                key={type}
                type={type}
                entries={groupEntries}
                onExport={EXPORTERS[type] ? () => handleExport(type) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
