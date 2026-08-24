import { useState } from 'react';
import { toast } from 'sonner';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  exportAttendanceCsv,
  exportMaterialsDeliveredCsv,
  exportMaterialsUsedCsv,
  exportSiteDiaryCsv,
} from '@/lib/csvExports';

const EXPORTERS = {
  attendance: { label: 'Attendance', fn: exportAttendanceCsv },
  delivery: { label: 'Materials Delivered', fn: exportMaterialsDeliveredCsv },
  usage: { label: 'Materials Used', fn: exportMaterialsUsedCsv },
  diary: { label: 'Site Diary', fn: exportSiteDiaryCsv },
} as const;

type ExportKey = keyof typeof EXPORTERS;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

type RangeMode = 'today' | 7 | 30 | 'custom';

interface ExportPanelProps {
  siteId: string;
  onClose: () => void;
}

// Restores the CSV export capability the old SiteReportView popover used
// to offer - that view is no longer reachable from anywhere since Site
// History moved to the feed, so this panel is its replacement home, not a
// duplicate.
export function ExportPanel({ siteId, onClose }: ExportPanelProps) {
  const [mode, setMode] = useState<RangeMode>(7);
  const [customStart, setCustomStart] = useState(daysAgo(7));
  const [customEnd, setCustomEnd] = useState(daysAgo(0));
  const [exportingKey, setExportingKey] = useState<ExportKey | null>(null);

  const { startDate, endDate } =
    mode === 'today'
      ? { startDate: daysAgo(0), endDate: daysAgo(0) }
      : mode === 'custom'
        ? { startDate: customStart, endDate: customEnd }
        : { startDate: daysAgo(mode), endDate: daysAgo(0) };

  const handleExport = async (key: ExportKey) => {
    setExportingKey(key);
    try {
      await EXPORTERS[key].fn(siteId, startDate, endDate);
      toast.success('CSV downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-primary">EXPORT CSV</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
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
          <div className="grid grid-cols-2 gap-2">
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

        <div className="space-y-2">
          {(Object.keys(EXPORTERS) as ExportKey[]).map((key) => (
            <Button
              key={key}
              variant="outline"
              className="w-full justify-between"
              disabled={exportingKey !== null}
              onClick={() => handleExport(key)}
            >
              {EXPORTERS[key].label}
              <Download className="w-4 h-4" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
