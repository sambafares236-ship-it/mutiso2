import { useState } from 'react';
import { toast } from 'sonner';
import { Banknote, X, Plus, Check, Clock, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSite, useUpdateSite } from '@/hooks/useSite';
import {
  useSitePayrollRuns,
  usePayrollLines,
  useGeneratePayrollRun,
  useGenerateDailyPayrollRun,
  useUngeneratedPayrollPeriods,
  useUpdatePayrollLine,
  useMarkPayrollLinePaid,
  usePayrollSummary,
  mondayOfThisWeek,
  sundayOfThisWeek,
} from '@/hooks/usePayroll';
import { formatKES } from '@/lib/utils';
import { exportPayrollCsv } from '@/lib/csvExports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface PayrollViewProps {
  siteId: string;
  onClose: () => void;
}

function PayrollSummaryHeader({ siteId }: { siteId: string }) {
  const { data: summary, isLoading } = usePayrollSummary(siteId);

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl mb-4" />;
  }

  // Red until this week's run is confirmed and every line is paid - see
  // the same logic in ProjectOverviewView's Finance Summary card.
  const weekPending = !summary?.weekConfirmed || (summary?.weekPending ?? 0) > 0;

  return (
    <div className="card-industrial p-4 mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Today's Payroll</p>
          <p className="text-xl font-bold text-destructive">{formatKES(summary?.todayTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">This Week</p>
          <p className={`text-xl font-bold ${weekPending ? 'text-destructive' : 'text-foreground'}`}>{formatKES(summary?.weekTotal)}</p>
          {summary?.weekConfirmed ? (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Paid {formatKES(summary.weekPaid)} · Pending {formatKES(summary.weekPending)}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5">Estimated - not yet generated</p>
          )}
        </div>
      </div>
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Payroll (paid to date)</p>
        <p className="text-xl font-bold text-success">{formatKES(summary?.totalPaidAllTime)}</p>
      </div>
    </div>
  );
}

function PayrollLineRow({
  line,
  siteId,
}: {
  line: ReturnType<typeof usePayrollLines>['data'] extends (infer T)[] | undefined ? T : never;
  siteId: string;
}) {
  const { isContractor } = useAuth();
  const [advances, setAdvances] = useState(String(line.advances));
  const [deductions, setDeductions] = useState(String(line.deductions));
  const updateLine = useUpdatePayrollLine();
  const markPaid = useMarkPayrollLinePaid();

  const handleSave = async () => {
    try {
      await updateLine.mutateAsync({
        lineId: line.id,
        advances: Number(advances) || 0,
        deductions: Number(deductions) || 0,
        grossAmount: line.gross_amount,
      });
      toast.success('Updated');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleMarkPaid = async () => {
    try {
      await markPaid.mutateAsync({ lineId: line.id, siteId });
      toast.success('Marked as paid');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="card-industrial p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm text-foreground">{line.worker?.full_name ?? 'Unknown worker'}</p>
        <p className="text-xs text-muted-foreground">{line.days_present} day(s) × KES {line.daily_rate}</p>
      </div>

      {/* Advances/deductions stay owner-only, same as generating the run
          itself - only mark-paid moved to the foreman. */}
      {isContractor && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <Label className="text-[10px]">Advances</Label>
            <Input className="h-8 text-xs" type="number" value={advances} onChange={(e) => setAdvances(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px]">Deductions</Label>
            <Input className="h-8 text-xs" type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-primary">
          Net: KES {line.gross_amount - (Number(advances) || 0) - (Number(deductions) || 0)}
        </p>
        <div className="flex gap-2">
          {isContractor && (
            <Button size="sm" variant="outline" onClick={handleSave} disabled={updateLine.isPending}>
              Save
            </Button>
          )}
          {line.paid ? (
            <span className="text-xs text-success flex items-center gap-1">
              <Check className="w-3 h-3" /> Paid
            </span>
          ) : isContractor ? (
            <span className="text-xs text-destructive flex items-center gap-1">
              <Clock className="w-3 h-3" /> Pending
            </span>
          ) : (
            <Button size="sm" variant="construction" onClick={handleMarkPaid} disabled={markPaid.isPending}>
              Mark Paid
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Lists periods with attendance logged but no payroll_run yet - see
// get_ungenerated_payroll_periods. A day period (period_start ===
// period_end) gets the lighter one-click daily generate; a week period
// uses the same generate flow as "Generate This Week's Payroll". Owner-
// only, same as every other Generate action - a foreman can see the gap
// exists via the Finance Summary note but acting on it is a financial
// decision, not field capture.
function UngeneratedPayrollReminder({ siteId, onGenerated }: { siteId: string; onGenerated: (runId: string) => void }) {
  const { isContractor } = useAuth();
  const { data: periods, isLoading } = useUngeneratedPayrollPeriods(siteId);
  const generateRun = useGeneratePayrollRun();
  const generateDaily = useGenerateDailyPayrollRun();

  if (!isContractor || isLoading || !periods?.length) return null;

  const handleGenerate = async (period: { period_start: string; period_end: string }) => {
    const isDay = period.period_start === period.period_end;
    try {
      const runId = isDay
        ? await generateDaily.mutateAsync({ siteId, date: period.period_start })
        : await generateRun.mutateAsync({ siteId, weekStart: period.period_start, weekEnd: period.period_end });
      toast.success('Payroll generated');
      onGenerated(runId as string);
    } catch (err) {
      toast.error('Could not generate payroll', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const pending = generateRun.isPending || generateDaily.isPending;

  return (
    <div className="card-industrial p-3 mb-4 border-destructive/40">
      <p className="text-xs font-medium text-destructive uppercase tracking-wide mb-2">
        {periods.length} payroll period{periods.length > 1 ? 's' : ''} not yet generated
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">
        Attendance is logged for these, but they're not counted in project costs yet.
      </p>
      <div className="space-y-2">
        {periods.map((p) => {
          const isDay = p.period_start === p.period_end;
          return (
            <div key={`${p.period_start}-${p.period_end}`} className="flex items-center justify-between gap-2">
              <span className="text-sm text-foreground">
                {isDay ? p.period_start : `${p.period_start} – ${p.period_end}`}
              </span>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => handleGenerate(p)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Generate
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Owner-only. Weekly stays the default for any site that hasn't changed
// it - this toggle is additive, not a migration prompt. Switching cadence
// doesn't touch existing payroll_run rows; it only changes how
// get_ungenerated_payroll_periods buckets attendance going forward and
// which Generate flow (daily one-click vs weekly range) the UI defaults
// to below.
function PayrollCadenceToggle({ siteId }: { siteId: string }) {
  const { data: site } = useSite(siteId);
  const updateSite = useUpdateSite();
  const cadence = site?.payroll_cadence ?? 'weekly';

  const setCadence = (value: 'daily' | 'weekly') => {
    if (value === cadence) return;
    updateSite.mutate(
      { siteId, updates: { payroll_cadence: value } },
      {
        onError: (err) => toast.error('Could not update payroll cadence', { description: err instanceof Error ? err.message : undefined }),
      },
    );
  };

  return (
    <div className="flex items-center gap-2 mb-4 text-xs">
      <span className="text-muted-foreground">Generate payroll:</span>
      <div className="flex rounded-md border border-border overflow-hidden">
        <button
          type="button"
          className={`px-2.5 py-1 ${cadence === 'weekly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          onClick={() => setCadence('weekly')}
          disabled={updateSite.isPending}
        >
          Weekly
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 ${cadence === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          onClick={() => setCadence('daily')}
          disabled={updateSite.isPending}
        >
          Daily
        </button>
      </div>
    </div>
  );
}

export function PayrollView({ siteId, onClose }: PayrollViewProps) {
  const { isContractor } = useAuth();
  const { data: runs, isLoading } = useSitePayrollRuns(siteId);
  const generateRun = useGeneratePayrollRun();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: lines, isLoading: linesLoading } = usePayrollLines(selectedRunId ?? undefined);

  // generate_payroll_run now upserts: if a run already exists for these
  // dates it recalculates its lines from current attendance instead of
  // inserting a duplicate (blocked only if a line in it is already paid -
  // see the migration). Clicking the button when a run exists still just
  // opens it, to view, rather than recalculating as a side effect of
  // "View" - recalculating is its own explicit action below.
  const currentWeekRun = runs?.find((r) => r.week_start === mondayOfThisWeek() && r.week_end === sundayOfThisWeek());
  const selectedRun = runs?.find((r) => r.id === selectedRunId);

  const handleExportPayroll = async () => {
    if (!selectedRun) return;
    try {
      await exportPayrollCsv(selectedRun.id, selectedRun.week_start, selectedRun.week_end);
      toast.success('CSV downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  };

  const handleGenerateOrView = async () => {
    if (currentWeekRun) {
      setSelectedRunId(currentWeekRun.id);
      return;
    }
    try {
      const runId = await generateRun.mutateAsync({
        siteId,
        weekStart: mondayOfThisWeek(),
        weekEnd: sundayOfThisWeek(),
      });
      toast.success('Payroll run generated');
      setSelectedRunId(runId as string);
    } catch (err) {
      toast.error('Could not generate payroll', { description: err instanceof Error ? err.message : undefined });
    }
  };

  // Recalculates an already-open run from current attendance - the fix
  // for generating mid-week and being stuck with a partial total. Blocked
  // by the RPC (not just this handler) if any line in the run is already
  // marked paid.
  const handleRecalculate = async () => {
    if (!selectedRun) return;
    try {
      await generateRun.mutateAsync({ siteId, weekStart: selectedRun.week_start, weekEnd: selectedRun.week_end });
      toast.success('Payroll recalculated from current attendance');
    } catch (err) {
      toast.error('Could not recalculate', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Banknote className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">PAYROLL</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <PayrollSummaryHeader siteId={siteId} />

        {selectedRunId ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(null)}>
                &larr; Back to runs
              </Button>
              <div className="flex items-center gap-2">
                {isContractor && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRecalculate} disabled={generateRun.isPending}>
                    <Banknote className="w-3.5 h-3.5" />
                    Recalculate
                  </Button>
                )}
                {!!lines?.length && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPayroll}>
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>
            {linesLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : !lines?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No attendance recorded for this week.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((line) => (
                  <PayrollLineRow key={line.id} line={line} siteId={siteId} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {isContractor && <PayrollCadenceToggle siteId={siteId} />}
            <UngeneratedPayrollReminder siteId={siteId} onGenerated={setSelectedRunId} />

            {(currentWeekRun || isContractor) && (
              <Button variant="outline" size="sm" className="mb-4" onClick={handleGenerateOrView} disabled={generateRun.isPending}>
                {currentWeekRun ? (
                  <>
                    <Banknote className="w-4 h-4 mr-1" /> View This Week's Payroll
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" /> Generate This Week's Payroll
                  </>
                )}
              </Button>
            )}
            {!currentWeekRun && !isContractor && (
              <p className="text-xs text-muted-foreground mb-4">
                Your contractor hasn't generated this week's payroll yet - check back once they have to mark wages paid.
              </p>
            )}

            {isLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : !runs?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No payroll runs yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className="w-full text-left p-3 bg-card rounded-xl border border-border hover:border-primary/50 transition-all"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {run.week_start} — {run.week_end}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
