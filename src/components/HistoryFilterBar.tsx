import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HistoryTypeFilter } from '@/hooks/useSiteHistoryFeed';
import {
  exportAttendanceCsv,
  exportMaterialsDeliveredCsv,
  exportMaterialsUsedCsv,
  exportSiteDiaryCsv,
  exportSiteHistoryCsv,
} from '@/lib/csvExports';
import {
  MAX_VIEW_DAYS,
  addDays,
  formatRangeLabel,
  today,
  type DateRange,
  type PeriodPreset,
} from '@/lib/historyPeriod';

const TYPE_OPTIONS: { value: HistoryTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'delivery', label: 'Delivered' },
  { value: 'usage', label: 'Used' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'diary', label: 'Diary' },
];

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'thisWeek', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

interface HistoryFilterBarProps {
  siteId: string;
  type: HistoryTypeFilter;
  onTypeChange: (type: HistoryTypeFilter) => void;
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (date: string) => void;
  onCustomEndChange: (date: string) => void;
  range: DateRange;
  totalCount: number;
  isLoading: boolean;
}

// Sits above the Site History feed. What the contractor has selected here -
// kind of record and period - is exactly what the Download button exports,
// so the file always matches the screen.
export function HistoryFilterBar({
  siteId,
  type,
  onTypeChange,
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  range,
  totalCount,
  isLoading,
}: HistoryFilterBarProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { startDate, endDate } = range;
      if (type === 'delivery') await exportMaterialsDeliveredCsv(siteId, startDate, endDate);
      else if (type === 'usage') await exportMaterialsUsedCsv(siteId, startDate, endDate);
      else if (type === 'attendance') await exportAttendanceCsv(siteId, startDate, endDate);
      else if (type === 'diary') await exportSiteDiaryCsv(siteId, startDate, endDate);
      else await exportSiteHistoryCsv(siteId, startDate, endDate);
      toast.success('CSV downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setDownloading(false);
    }
  };

  const t = today();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={type === o.value ? 'construction' : 'outline'}
            onClick={() => onTypeChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={preset === o.value ? 'secondary' : 'ghost'}
            className={preset === o.value ? '' : 'text-muted-foreground'}
            onClick={() => onPresetChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={customStart}
                max={customEnd}
                min={addDays(customEnd, -(MAX_VIEW_DAYS - 1))}
                onChange={(e) => e.target.value && onCustomStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={customEnd}
                min={customStart}
                max={t}
                onChange={(e) => e.target.value && onCustomEndChange(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Up to {MAX_VIEW_DAYS} days at a time.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatRangeLabel(range)}
          {!isLoading && ` · ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`}
        </p>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download CSV
        </Button>
      </div>
    </div>
  );
}
