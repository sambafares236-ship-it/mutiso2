import { useState } from 'react';
import { toast } from 'sonner';
import {
  X,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Flag,
  Wallet,
  History,
  Save,
  ChevronRight,
  Banknote,
  FileEdit,
  Upload,
  ListTree,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Users2,
  Receipt,
  Truck,
  Package,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteActivities } from '@/hooks/useActivities';
import { useScheduleProgress } from '@/hooks/useScheduleProgress';
import { useSaveScheduleBaseline } from '@/hooks/useScheduleBaseline';
import { useSiteMilestones } from '@/hooks/useMilestones';
import { useFinanceSummary } from '@/hooks/useFinanceSummary';
import { useSiteReport } from '@/hooks/useSiteReport';
import { useSiteVisitors } from '@/hooks/useVisitors';
import { useSiteCertifications, isExpiringSoon } from '@/hooks/useCertifications';
import { useSitePermits } from '@/hooks/usePermits';
import { useSiteDefects } from '@/hooks/useDefects';
import { usePayrollSummary } from '@/hooks/usePayroll';
import { useSitePettyCashTotal } from '@/hooks/usePettyCash';
import { useSiteTools, useEquipmentEfficiency } from '@/hooks/useTools';
import { useInventory } from '@/hooks/useMaterials';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleSummaryChart } from '@/components/ScheduleSummaryChart';
import { CategoryRow, TYPE_ORDER } from '@/components/CategoryRow';
import { MilestonesView } from './MilestonesView';
import { SiteReportView } from './SiteReportView';
import { PayrollView } from './PayrollView';
import { VariationOrdersView } from './VariationOrdersView';
import { ScheduleUploadDialog } from './ScheduleUploadDialog';
import { ScheduleDetailView } from './ScheduleDetailView';
import { ContractView } from './ContractView';
import { BudgetView } from './BudgetView';
import { PaymentCertificatesView } from './PaymentCertificatesView';
import { CertificationsView } from './CertificationsView';
import { SubcontractorsView } from './SubcontractorsView';
import { MaterialPaymentsView } from './MaterialPaymentsView';
import { InventoryView, LOW_STOCK_THRESHOLD } from './InventoryView';
import { PettyCashHistoryView } from './PettyCashHistoryView';
import { QualityProgressView } from './QualityProgressView';
import { HeavyEquipmentView } from './HeavyEquipmentView';

interface ProjectOverviewViewProps {
  siteId: string;
  siteName: string;
  subscriptionTier: 'field_ops' | 'pro';
  onClose: () => void;
}

function ScheduleSection({ siteId, onViewDetail }: { siteId: string; onViewDetail: () => void }) {
  const { isContractor } = useAuth();
  const { data: activities, isLoading } = useSiteActivities(siteId);
  const { data: progress } = useScheduleProgress(siteId);
  const saveBaseline = useSaveScheduleBaseline();
  const [showUpload, setShowUpload] = useState(false);

  const overallPercent = activities?.length
    ? activities.reduce((sum, a) => sum + a.percent_complete, 0) / activities.length
    : 0;

  // A baseline can exist and still be useless to compare against: it may
  // have been snapshotted while the WBS had names but no planned dates
  // (an import whose date columns didn't parse), or its activities may
  // since have been replaced by a re-upload. Either way every row lands in
  // 'unknown' and the card would otherwise show zeros next to a healthy
  // percent ring - which reads as a broken chart rather than as an
  // actionable "re-save your baseline".
  const baselineUnusable =
    !!progress?.baseline && progress.items.length > 0 && progress.unknown === progress.items.length;
  const hasDatedActivities = !!activities?.some((a) => a.planned_start && a.planned_end);

  const handleSaveBaseline = async () => {
    // Snapshotting a WBS with no planned dates produces a baseline nothing
    // can ever be measured against - that's how this site ended up with 67
    // dateless baseline rows. Refuse it at the point of saving instead.
    if (!hasDatedActivities) {
      toast.error('Nothing to baseline yet', {
        description: 'None of these activities have planned start and end dates. Upload or add dates first.',
      });
      return;
    }
    try {
      await saveBaseline.mutateAsync({ site_id: siteId });
      toast.success('Schedule baseline saved', { description: 'This is now the reference point for progress tracking.' });
    } catch (err) {
      toast.error('Could not save baseline', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-3">
      {progress?.baseline ? (
        <ScheduleSummaryChart
          ahead={progress.ahead}
          onTrack={progress.onTrack}
          behind={progress.behind}
          unknown={progress.unknown}
          overallPercent={overallPercent}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          No schedule baseline saved yet. Add activities, then save a baseline to start tracking progress.
        </p>
      )}

      {baselineUnusable && (
        <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Save className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Your saved baseline can&apos;t be compared to these activities — it has no planned dates, or the schedule has
            been re-uploaded since.{' '}
            {isContractor
              ? 'Save the schedule as a baseline again to start tracking ahead/behind.'
              : 'Ask the contractor to save the schedule as a baseline again.'}
          </p>
        </div>
      )}

      {progress?.mostDelayed && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">
            Most delayed: <strong>{progress.mostDelayed.name}</strong>
            {progress.mostDelayed.delayDays !== null && ` — ~${Math.abs(progress.mostDelayed.delayDays)} day(s) behind`}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onViewDetail}>
          <ListTree className="w-4 h-4 mr-1" /> View all activities ({activities?.length ?? 0})
        </Button>
        {isContractor && (
          <>
            <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4 mr-1" /> Upload schedule
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveBaseline} disabled={saveBaseline.isPending || !activities?.length}>
              <Save className="w-4 h-4 mr-1" /> Save schedule as baseline
            </Button>
          </>
        )}
      </div>

      {showUpload && (
        <ScheduleUploadDialog siteId={siteId} existingCount={activities?.length ?? 0} onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}

function SiteHistoryPreview({ siteId, onOpenHistory }: { siteId: string; onOpenHistory: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const { data: entries, isLoading } = useSiteReport(siteId, today, today);

  // Defects are excluded here - they now have their own dedicated card
  // on this page with richer detail (both photos, verify action) than
  // this generic feed shows.
  const groups = TYPE_ORDER.filter((type) => type !== 'defect')
    .map((type) => ({
      type,
      entries: entries?.filter((e) => e.type === type) ?? [],
    }))
    .filter((g) => g.entries.length > 0);

  // Today's photos only, derived from the same date-scoped query as
  // everything else here - previously this pulled from useSitePhotos
  // (every photo ever taken on the site) and just sliced the 2 most
  // recent, which could silently show an old photo on a day nothing was
  // actually uploaded. Empty means empty now. Pulls from both freestanding
  // `photo` entries and photos attached to a diary entry (`images`) -
  // otherwise a site that only ever uploads photos via the diary flow
  // would never populate this preview strip.
  const previewPhotos = (entries ?? [])
    .flatMap((e) =>
      e.type === 'photo' && e.imageUrl
        ? [{ id: e.id, url: e.imageUrl, title: e.title }]
        : (e.images ?? []).map((url, i) => ({ id: `${e.id}-${i}`, url, title: e.title })),
    )
    .slice(0, 2);

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-3">
      {previewPhotos.length > 0 && (
        <div className="flex gap-2">
          {previewPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={onOpenHistory}
              className="block w-20 h-20 rounded-lg overflow-hidden border border-border flex-shrink-0 hover:brightness-110 transition-[filter]"
            >
              <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {groups.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {groups.map(({ type, entries: groupEntries }) => (
            <CategoryRow key={type} type={type} entries={groupEntries} compact onClick={onOpenHistory} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No activity logged today yet.</p>
      )}
    </div>
  );
}

function CertificationsSummary({ siteId }: { siteId: string }) {
  const { data: certs, isLoading } = useSiteCertifications(siteId);

  if (isLoading) {
    return <Skeleton className="h-8 w-full rounded-lg" />;
  }

  const expiringCount = certs?.filter((c) => isExpiringSoon(c.expiry_date)).length ?? 0;

  return (
    <p className="text-sm text-muted-foreground">
      {certs?.length ?? 0} certification{certs?.length === 1 ? '' : 's'} tracked.
      {expiringCount > 0 && (
        <span className="flex items-center gap-1 text-destructive mt-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {expiringCount} expiring within 30 days
        </span>
      )}
    </p>
  );
}

// Combined summary for the merged Defects+Permits card - each still has
// its own "awaiting your X" nudge, just stacked in one card instead of
// two, matching the QualityProgressView tab-switcher they open into.
function QualityProgressSummary({ siteId }: { siteId: string }) {
  const { data: defects, isLoading: defectsLoading } = useSiteDefects(siteId);
  const { data: permits, isLoading: permitsLoading } = useSitePermits(siteId);

  if (defectsLoading || permitsLoading) {
    return <Skeleton className="h-8 w-full rounded-lg" />;
  }

  const awaitingVerification = defects?.filter((d) => d.status === 'in_progress').length ?? 0;
  const awaitingDecision = permits?.filter((p) => p.status === 'pending').length ?? 0;

  return (
    <div className="text-sm text-muted-foreground space-y-1">
      <p>
        {defects?.length ?? 0} defect{defects?.length === 1 ? '' : 's'} · {permits?.length ?? 0} permit
        {permits?.length === 1 ? '' : 's'} requested.
      </p>
      {awaitingVerification > 0 && (
        <p className="flex items-center gap-1 text-warning">
          <AlertTriangle className="w-3.5 h-3.5" /> {awaitingVerification} defect{awaitingVerification === 1 ? '' : 's'} awaiting your
          verification
        </p>
      )}
      {awaitingDecision > 0 && (
        <p className="flex items-center gap-1 text-warning">
          <AlertTriangle className="w-3.5 h-3.5" /> {awaitingDecision} permit{awaitingDecision === 1 ? '' : 's'} awaiting your decision
        </p>
      )}
    </div>
  );
}

function HeavyEquipmentSummary({ siteId }: { siteId: string }) {
  const { data: allTools, isLoading: toolsLoading } = useSiteTools(siteId);
  const { data: efficiency, isLoading: effLoading } = useEquipmentEfficiency(siteId);
  const equipment = allTools?.filter((t) => t.category === 'plant');

  if (toolsLoading || effLoading) {
    return <Skeleton className="h-8 w-full rounded-lg" />;
  }

  const inUse = equipment?.filter((t) => t.status === 'checked_out').length ?? 0;
  const dueForService = Object.values(efficiency ?? {}).filter((e) => e.maintenanceDue).length;

  return (
    <p className="text-sm text-muted-foreground">
      {equipment?.length ?? 0} item{equipment?.length === 1 ? '' : 's'} · {inUse} in use.
      {dueForService > 0 && (
        <span className="flex items-center gap-1 text-warning mt-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {dueForService} due for service
        </span>
      )}
    </p>
  );
}

// Same-day visitor count, computed client-side like every other "N days
// out" badge in this app (isExpiringSoon, AtAGlanceStats) rather than a
// notifications-table trigger - see CLAUDE.md's "Known Gotchas" note on
// why simple date-based badges stay client-side.
function VisitorTodayBadge({ siteId }: { siteId: string }) {
  const { data: visitors } = useSiteVisitors(siteId);
  const today = new Date().toISOString().split('T')[0];
  const todayCount = visitors?.filter((v) => v.time_in.startsWith(today)).length ?? 0;

  if (todayCount === 0) return null;

  return (
    <span
      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: 'hsl(var(--cat-visitor) / 0.2)', color: 'hsl(var(--cat-visitor))' }}
    >
      <UserCheck className="w-3 h-3" /> {todayCount} visitor{todayCount === 1 ? '' : 's'} today
    </span>
  );
}

// Compact stock summary for the Overview card - the low-stock items first,
// since "what are we about to run out of" is the only part of the balance
// that's urgent at a glance. Everything else is behind "View all".
function InventorySummary({ siteId }: { siteId: string }) {
  const { data: inventory, isLoading } = useInventory(siteId);

  if (isLoading) return <Skeleton className="h-20 w-full rounded-lg" />;
  if (!inventory?.length) {
    return <p className="text-sm text-muted-foreground">No stock recorded yet — it builds up from logged deliveries.</p>;
  }

  const low = inventory.filter((item) => Number(item.current_quantity) <= LOW_STOCK_THRESHOLD);
  const preview = [...(low.length ? low : inventory)]
    .sort((a, b) => Number(a.current_quantity) - Number(b.current_quantity))
    .slice(0, 3);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Items in stock</span>
        <span className="font-medium text-foreground">{inventory.length}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Low stock</span>
        <span className={`font-medium ${low.length ? 'text-destructive' : 'text-success'}`}>{low.length}</span>
      </div>
      <div className="space-y-1 pt-1">
        {preview.map((item) => {
          const isLow = Number(item.current_quantity) <= LOW_STOCK_THRESHOLD;
          return (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="text-muted-foreground truncate mr-2">{item.material_name}</span>
              <span className={isLow ? 'text-destructive' : 'text-foreground'}>
                {item.current_quantity} {item.unit ?? ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof LayoutDashboard;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-industrial p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-foreground flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" /> {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ProjectOverviewView({ siteId, siteName, subscriptionTier, onClose }: ProjectOverviewViewProps) {
  const { isContractor } = useAuth();
  // Feature gate, mirroring the tier RLS gate (owns_pro_site/
  // is_assigned_foreman_of_pro_site) - hiding these here is a UX nicety,
  // the database is what actually enforces it.
  const isPro = subscriptionTier === 'pro';
  const { data: milestones } = useSiteMilestones(siteId);
  const { data: finance, isLoading: financeLoading } = useFinanceSummary(siteId);
  const { data: payroll } = usePayrollSummary(siteId);
  const { data: pettyCashTotal } = useSitePettyCashTotal(siteId);
  // Red until this week's payroll is confirmed (generated) AND fully
  // paid out - the moment the last line is marked paid, weekPending hits
  // 0 and the red state clears; the amount is already reflected in
  // totalPaidAllTime by then.
  const weekPending = !payroll?.weekConfirmed || (payroll?.weekPending ?? 0) > 0;
  const [subView, setSubView] = useState<
    | 'schedule'
    | 'milestones'
    | 'contract'
    | 'budget'
    | 'certificates'
    | 'payroll'
    | 'variations'
    | 'history'
    | 'certifications'
    | 'subcontractors'
    | 'materialPayments'
    | 'inventory'
    | 'pettyCash'
    | 'qualityProgress'
    | 'heavyEquipment'
    | null
  >(null);

  const completedMilestones = milestones?.filter((m) => m.status === 'completed').length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <LayoutDashboard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl text-primary">OVERVIEW</h2>
              <p className="text-xs text-muted-foreground">{siteName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="space-y-4">
          {isPro && (
            <SectionCard icon={TrendingUp} title="Progress & Schedule">
              <ScheduleSection siteId={siteId} onViewDetail={() => setSubView('schedule')} />
            </SectionCard>
          )}

          <SectionCard
            icon={History}
            title="Site History"
            action={
              <div className="flex items-center gap-2">
                <VisitorTodayBadge siteId={siteId} />
                <Button size="sm" variant="ghost" onClick={() => setSubView('history')}>
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            }
          >
            <SiteHistoryPreview siteId={siteId} onOpenHistory={() => setSubView('history')} />
          </SectionCard>

          {isPro && (
            <SectionCard
              icon={Flag}
              title="Milestones"
              action={
                <Button size="sm" variant="ghost" onClick={() => setSubView('milestones')}>
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                {completedMilestones} of {milestones?.length ?? 0} milestones complete.
              </p>
            </SectionCard>
          )}

          {isPro && (
            <SectionCard
              icon={Flag}
              title="Quality & Progress"
              action={
                <Button size="sm" variant="ghost" onClick={() => setSubView('qualityProgress')}>
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              }
            >
              <QualityProgressSummary siteId={siteId} />
            </SectionCard>
          )}

          {isPro && (
            <SectionCard
              icon={Truck}
              title="Heavy Equipment"
              action={
                <Button size="sm" variant="ghost" onClick={() => setSubView('heavyEquipment')}>
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              }
            >
              <HeavyEquipmentSummary siteId={siteId} />
            </SectionCard>
          )}

          {isPro && (
            <SectionCard
              icon={ShieldCheck}
              title="Certifications"
              action={
                <Button size="sm" variant="ghost" onClick={() => setSubView('certifications')}>
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              }
            >
              <CertificationsSummary siteId={siteId} />
            </SectionCard>
          )}

          {/* Sits directly above Finance Summary on purpose: stock is the
              physical counterpart of the money below it, and Material
              Payments belongs with materials rather than buried in the
              finance button grid. */}
          <SectionCard
            icon={Package}
            title="Materials & Stock"
            action={
              <Button size="sm" variant="ghost" onClick={() => setSubView('inventory')}>
                View all <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            }
          >
            <InventorySummary siteId={siteId} />
            <Button size="sm" variant="outline" className="w-full" onClick={() => setSubView('materialPayments')}>
              <Receipt className="w-4 h-4 mr-1" /> Material Payments
            </Button>
          </SectionCard>

          <SectionCard icon={Wallet} title="Finance Summary">
            {/* Money management (Budget, Actual costs, Payroll, Variance) is
                base-tier - only Contract value and Latest payment cert stay
                Pro-only, matching site_contract/payment_certificate's own
                RLS gate. */}
            {financeLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <div className="space-y-2 text-sm">
                {isPro && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract value</span>
                    <span className="font-medium text-foreground">{formatKES(finance?.contractValue, finance?.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium text-foreground">{formatKES(finance?.budgetTotal, finance?.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual to date (labor + other)</span>
                  <span className="font-medium text-foreground">{formatKES(finance?.actualTotal, finance?.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Today's payroll</span>
                  <span className="font-medium text-destructive">{formatKES(payroll?.todayTotal)}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">This week's payroll</span>
                  <span className="text-right">
                    <span className={`font-medium block ${weekPending ? 'text-destructive' : 'text-foreground'}`}>
                      {formatKES(payroll?.weekTotal)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {payroll?.weekConfirmed
                        ? `Paid ${formatKES(payroll.weekPaid)} · Pending ${formatKES(payroll.weekPending)}`
                        : 'Estimated - not yet generated'}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total payroll (paid to date)</span>
                  <span className="font-medium text-success">{formatKES(payroll?.totalPaidAllTime)}</span>
                </div>
                {finance?.variance !== null && finance?.variance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variance</span>
                    <span className={`font-medium ${finance.variance < 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatKES(finance.variance, finance.currency)}
                    </span>
                  </div>
                )}
                {isPro && finance?.latestCertificate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latest payment cert</span>
                    <span className="font-medium text-foreground capitalize">
                      #{finance.latestCertificate.certificate_number} · {finance.latestCertificate.status}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Petty Cash stays base-tier - always visible regardless of subscription tier. */}
            <button
              type="button"
              onClick={() => setSubView('pettyCash')}
              className="w-full flex justify-between items-center hover:opacity-80 transition-opacity text-sm mt-2"
            >
              <span className="text-muted-foreground flex items-center gap-1">
                Petty cash (project to date) <ChevronRight className="w-3 h-3" />
              </span>
              <span className="font-medium text-foreground">{formatKES(pettyCashTotal)}</span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {isContractor && isPro && (
                <Button size="sm" variant="outline" onClick={() => setSubView('contract')}>
                  Contract
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setSubView('budget')}>
                Budget & Costs
              </Button>
              {isPro && (
                <Button size="sm" variant="outline" onClick={() => setSubView('certificates')}>
                  Payment Certs
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setSubView('payroll')}>
                <Banknote className="w-4 h-4 mr-1" /> Payroll
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSubView('variations')}>
                <FileEdit className="w-4 h-4 mr-1" /> Variations
              </Button>
              {isPro && (
                <Button size="sm" variant="outline" onClick={() => setSubView('subcontractors')}>
                  <Users2 className="w-4 h-4 mr-1" /> Subcontractors
                </Button>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {subView === 'schedule' && <ScheduleDetailView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'milestones' && <MilestonesView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'history' && <SiteReportView siteId={siteId} onClose={() => setSubView(null)} excludeTypes={['defect']} />}
      {subView === 'payroll' && <PayrollView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'variations' && <VariationOrdersView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'contract' && <ContractView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'budget' && <BudgetView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'certificates' && <PaymentCertificatesView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'certifications' && <CertificationsView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'subcontractors' && <SubcontractorsView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'pettyCash' && <PettyCashHistoryView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'qualityProgress' && <QualityProgressView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'heavyEquipment' && <HeavyEquipmentView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'materialPayments' && <MaterialPaymentsView siteId={siteId} onClose={() => setSubView(null)} />}
      {subView === 'inventory' && <InventoryView siteId={siteId} onClose={() => setSubView(null)} />}
    </div>
  );
}
