import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Truck, X, Plus, History, Gauge, TrendingUp, Wrench, ShieldCheck, AlertTriangle, Pencil, Trash2, Play, Pause, Square } from 'lucide-react';
import {
  useSiteTools,
  useAddEquipment,
  useUpdateEquipment,
  useActiveUsageSession,
  useToolUsageSessions,
  useStartUsageSession,
  usePauseUsageSession,
  useResumeUsageSession,
  useStopUsageSession,
  useEquipmentEfficiency,
  activeSecondsFromEvents,
  type Tool,
  type ForemanTool,
} from '@/hooks/useTools';
import { useAuth } from '@/hooks/useAuth';
import { useSiteCertifications, useDeleteCertification, isExpiringSoon, type Certification } from '@/hooks/useCertifications';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaintenanceSection } from './ToolsView';
import { CertificationForm } from './CertificationsView';

interface HeavyEquipmentViewProps {
  siteId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  paused: 'Paused (break)',
  maintenance: 'In maintenance',
  lost: 'Lost',
};

const STATUS_STYLES: Record<string, string> = {
  idle: 'text-muted-foreground',
  running: 'text-success',
  paused: 'text-warning',
  maintenance: 'text-blue-400',
  lost: 'text-destructive',
};

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return '0m';
  return `${h > 0 ? `${h}h ` : ''}${m}m`;
}

// Contractor-only: registers plant with its rate and active flag in one
// go - there's no separate authorization step, this IS the moment
// equipment becomes real in the system.
const addEquipmentSchema = z.object({
  tool_name: z.string().min(1, 'Equipment name is required'),
  tool_id_number: z.string().optional(),
  meter_unit: z.string().optional(),
  cost_per_hour: z.string().optional(),
  is_active: z.boolean(),
});
type AddEquipmentValues = z.infer<typeof addEquipmentSchema>;

function AddEquipmentForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const addEquipment = useAddEquipment();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddEquipmentValues>({
    resolver: zodResolver(addEquipmentSchema),
    defaultValues: { meter_unit: 'none', is_active: true },
  });

  const onSubmit = async (values: AddEquipmentValues) => {
    try {
      await addEquipment.mutateAsync({
        site_id: siteId,
        tool_name: values.tool_name,
        tool_id_number: values.tool_id_number,
        meter_unit: values.meter_unit === 'none' ? undefined : values.meter_unit,
        cost_per_hour: values.cost_per_hour ? Number(values.cost_per_hour) : undefined,
        is_active: values.is_active,
      });
      toast.success('Equipment added');
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-primary">ADD EQUIPMENT</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="tool_name">Equipment Name *</Label>
            <Input id="tool_name" placeholder="e.g., Concrete Mixer, Excavator" {...register('tool_name')} />
            {errors.tool_name && <p className="text-xs text-destructive">{errors.tool_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tool_id_number">Asset Tag / ID Number</Label>
            <Input id="tool_id_number" placeholder="e.g., PL-003" {...register('tool_id_number')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost_per_hour">Cost per hour (KES)</Label>
            <Input
              id="cost_per_hour"
              type="number"
              step="0.01"
              placeholder="e.g., 1500 (hire rate, fuel, operator - whatever this covers)"
              {...register('cost_per_hour')}
            />
            <p className="text-xs text-muted-foreground">Only the contractor ever sees this rate.</p>
          </div>
          <div className="space-y-2">
            <Label>Meter type (optional)</Label>
            <Select value={watch('meter_unit')} onValueChange={(v) => setValue('meter_unit', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not metered</SelectItem>
                <SelectItem value="hours">Engine hours</SelectItem>
                <SelectItem value="km">Kilometers</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only if this item has a meter you can read at start/stop.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
            <div>
              <Label htmlFor="is_active" className="cursor-pointer">
                Active on site
              </Label>
              <p className="text-xs text-muted-foreground">Off if registered but not yet delivered - foreman won't see it until on.</p>
            </div>
            <input id="is_active" type="checkbox" className="w-5 h-5" {...register('is_active')} />
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            ADD EQUIPMENT
          </Button>
        </form>
      </div>
    </div>
  );
}

// Contractor-only inline edit for rate / active toggle on an existing item.
function EditEquipmentForm({
  siteId,
  tool,
  onClose,
}: {
  siteId: string;
  tool: Tool;
  onClose: () => void;
}) {
  const updateEquipment = useUpdateEquipment();
  const [costPerHour, setCostPerHour] = useState(tool.cost_per_hour != null ? String(tool.cost_per_hour) : '');
  const [isActive, setIsActive] = useState(tool.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateEquipment.mutateAsync({
        id: tool.id,
        site_id: siteId,
        cost_per_hour: costPerHour ? Number(costPerHour) : undefined,
        is_active: isActive,
      });
      toast.success('Equipment updated');
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-primary">EDIT {tool.tool_name.toUpperCase()}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_cost_per_hour">Cost per hour (KES)</Label>
            <Input
              id="edit_cost_per_hour"
              type="number"
              step="0.01"
              value={costPerHour}
              onChange={(e) => setCostPerHour(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
            <Label htmlFor="edit_is_active" className="cursor-pointer">
              Active on site
            </Label>
            <input
              id="edit_is_active"
              type="checkbox"
              className="w-5 h-5"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </div>
          <Button variant="construction" size="touch" className="w-full" onClick={handleSave} disabled={isSubmitting}>
            SAVE
          </Button>
        </div>
      </div>
    </div>
  );
}

// Live "active so far" readout for a running/paused session - re-ticks
// every second off activeSecondsFromEvents rather than trusting a stored
// duration, so it stays correct across a pause without any extra state.
function LiveDuration({ events }: { events: { event_type: string; event_at: string }[] }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = activeSecondsFromEvents(events as never);
  return <span>{formatHours(seconds / 3600)}</span>;
}

function UsageControls({ siteId, tool, meterUnit }: { siteId: string; tool: Tool | ForemanTool; meterUnit: string | null }) {
  const { data: active, isLoading } = useActiveUsageSession(tool.id);
  const start = useStartUsageSession();
  const pause = usePauseUsageSession();
  const resume = useResumeUsageSession();
  const stop = useStopUsageSession();
  const [operatorName, setOperatorName] = useState('');
  const [meterReading, setMeterReading] = useState('');

  if (isLoading) return <Skeleton className="h-10 w-full rounded-lg mt-2" />;

  const handleStart = async () => {
    try {
      const result = await start.mutateAsync({
        toolId: tool.id,
        operatorName: operatorName.trim() || undefined,
        meterReading: meterReading ? Number(meterReading) : undefined,
      });
      setOperatorName('');
      setMeterReading('');
      toast.success('Equipment started', { description: operatorName ? `Operator: ${operatorName}` : undefined });
      void result;
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handlePause = async () => {
    if (!active) return;
    try {
      await pause.mutateAsync({ sessionId: active.session.id, toolId: tool.id });
      toast.info('Paused');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleResume = async () => {
    if (!active) return;
    try {
      await resume.mutateAsync({ sessionId: active.session.id, toolId: tool.id });
      toast.success('Resumed');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleStop = async () => {
    if (!active) return;
    try {
      await stop.mutateAsync({
        sessionId: active.session.id,
        toolId: tool.id,
        meterReading: meterReading ? Number(meterReading) : undefined,
      });
      setMeterReading('');
      toast.success('Stopped for the day');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (!active) {
    return (
      <div className="space-y-2 mt-2">
        <div className="flex gap-2">
          <Input
            placeholder="Operator name (optional)"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            className="text-xs h-9"
          />
          <Button size="sm" variant="construction" onClick={handleStart} disabled={start.isPending}>
            <Play className="w-3 h-3 mr-1" /> Start
          </Button>
        </div>
        {meterUnit && (
          <Input
            type="number"
            step="0.1"
            placeholder={`Meter reading (${meterUnit}, optional)`}
            value={meterReading}
            onChange={(e) => setMeterReading(e.target.value)}
            className="text-xs h-8"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {active.session.operator_name && <p className="text-xs text-muted-foreground">Operator: {active.session.operator_name}</p>}
      <p className="text-sm font-medium text-foreground">
        Active today: <LiveDuration events={active.events} />
        {active.session.status === 'paused' && <span className="text-warning"> · on break</span>}
      </p>
      <div className="flex gap-2">
        {active.session.status === 'running' ? (
          <Button size="sm" variant="outline" onClick={handlePause} disabled={pause.isPending}>
            <Pause className="w-3 h-3 mr-1" /> Pause
          </Button>
        ) : (
          <Button size="sm" variant="construction" onClick={handleResume} disabled={resume.isPending}>
            <Play className="w-3 h-3 mr-1" /> Resume
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={handleStop} disabled={stop.isPending}>
          <Square className="w-3 h-3 mr-1" /> Stop
        </Button>
      </div>
      {meterUnit && (
        <Input
          type="number"
          step="0.1"
          placeholder={`Meter reading on stop (${meterUnit}, optional)`}
          value={meterReading}
          onChange={(e) => setMeterReading(e.target.value)}
          className="text-xs h-8"
        />
      )}
    </div>
  );
}

function EfficiencyStats({
  hoursToday,
  costPerHour,
  runningCostToday,
  maintenanceDue,
  nextDueDate,
}: {
  hoursToday: number;
  costPerHour: number | null;
  runningCostToday: number | null;
  maintenanceDue: boolean;
  nextDueDate: string | null;
}) {
  // costPerHour === null covers both "no rate set" and "foreman session" -
  // either way there's nothing honest to show in that tile, so it's
  // omitted rather than showing a misleading "—".
  return (
    <div className={`grid ${costPerHour != null ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-2 mb-2`}>
      <div className="bg-secondary/60 rounded-lg p-2 text-center">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
          <Gauge className="w-3 h-3" /> Today
        </p>
        <p className="text-sm font-bold text-foreground">{formatHours(hoursToday)}</p>
        <p className="text-[9px] text-muted-foreground">active</p>
      </div>
      {costPerHour != null && (
        <div className="bg-secondary/60 rounded-lg p-2 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> Cost today
          </p>
          <p className="text-sm font-bold text-foreground">{runningCostToday != null ? formatKES(runningCostToday) : '—'}</p>
          <p className="text-[9px] text-muted-foreground">{formatKES(costPerHour)}/hr</p>
        </div>
      )}
      <div className={`rounded-lg p-2 text-center ${maintenanceDue ? 'bg-destructive/10' : 'bg-secondary/60'}`}>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
          <Wrench className="w-3 h-3" /> Service
        </p>
        <p className={`text-sm font-bold ${maintenanceDue ? 'text-destructive' : 'text-foreground'}`}>
          {maintenanceDue ? 'Due' : nextDueDate ? 'OK' : '—'}
        </p>
        {nextDueDate && <p className="text-[9px] text-muted-foreground">{nextDueDate}</p>}
      </div>
    </div>
  );
}

// Certifications filtered client-side from the site's full certification
// list (same "compute, don't store" pattern used elsewhere) rather than a
// per-tool query - a site's certification list is small and already
// fetched once by useSiteCertifications.
function EquipmentCertifications({
  toolId,
  certs,
  isContractor,
  onAdd,
  onEdit,
}: {
  toolId: string;
  certs: Certification[];
  isContractor: boolean;
  onAdd: () => void;
  onEdit: (cert: Certification) => void;
}) {
  const deleteCert = useDeleteCertification();
  const toolCerts = certs.filter((c) => c.tool_id === toolId);

  const handleDelete = async (cert: Certification) => {
    if (!window.confirm(`Delete "${cert.cert_name}"? This cannot be undone.`)) return;
    try {
      await deleteCert.mutateAsync({ id: cert.id, site_id: cert.site_id });
      toast.success('Certification deleted');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
          <ShieldCheck className="w-3 h-3" /> Certifications
        </p>
        {isContractor && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onAdd}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        )}
      </div>
      {!toolCerts.length ? (
        <p className="text-xs text-muted-foreground">No certifications tracked for this item.</p>
      ) : (
        <div className="space-y-1.5">
          {toolCerts.map((cert) => {
            const expiring = isExpiringSoon(cert.expiry_date);
            return (
              <div
                key={cert.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${expiring ? 'bg-destructive/10' : 'bg-secondary/60'}`}
              >
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">{cert.cert_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Expires {cert.expiry_date}
                    {cert.cert_number ? ` · #${cert.cert_number}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {expiring && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive">
                      <AlertTriangle className="w-3 h-3" /> Expiring
                    </span>
                  )}
                  {isContractor && (
                    <>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(cert)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(cert)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EquipmentHistory({ toolId, siteId }: { toolId: string; siteId: string }) {
  const { data: sessions, isLoading } = useToolUsageSessions(toolId);

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usage history</p>
        {isLoading ? (
          <Skeleton className="h-8 w-full rounded-lg" />
        ) : !sessions?.length ? (
          <p className="text-xs text-muted-foreground">No usage history yet.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-xs text-foreground">{s.operator_name || 'No operator logged'}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(s.started_at).toLocaleDateString('en-KE')}
                {s.status === 'ended' && s.ended_at ? ` · ended ${new Date(s.ended_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}` : ' · still open'}
              </p>
            </div>
          ))
        )}
      </div>
      <MaintenanceSection siteId={siteId} toolId={toolId} />
    </div>
  );
}

export function HeavyEquipmentView({ siteId, onClose }: HeavyEquipmentViewProps) {
  const { isContractor } = useAuth();
  const { data: allTools, isLoading } = useSiteTools(siteId);
  const equipment = (allTools?.filter((t) => t.category === 'plant') ?? []) as (Tool | ForemanTool)[];
  const { data: efficiency } = useEquipmentEfficiency(siteId);
  const { data: certs } = useSiteCertifications(siteId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [certFormToolId, setCertFormToolId] = useState<string | null>(null);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Truck className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">HEAVY EQUIPMENT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isContractor && (
          <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Equipment
          </Button>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : !equipment.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {isContractor ? 'No heavy equipment registered.' : 'No heavy equipment on this site yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {equipment.map((tool) => {
              const stats = efficiency?.[tool.id];
              return (
                <div key={tool.id} className="card-industrial p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{tool.tool_name}</p>
                      <p className="text-xs text-muted-foreground">{tool.tool_id_number || 'No asset tag'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!tool.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                      )}
                      <span className={`text-xs font-medium ${STATUS_STYLES[tool.status]}`}>{STATUS_LABELS[tool.status] ?? tool.status}</span>
                      {isContractor && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingTool(tool as Tool)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {stats && (
                    <EfficiencyStats
                      hoursToday={stats.hoursToday}
                      costPerHour={stats.costPerHour}
                      runningCostToday={stats.runningCostToday}
                      maintenanceDue={stats.maintenanceDue}
                      nextDueDate={stats.nextDueDate}
                    />
                  )}

                  {!isContractor && tool.is_active && tool.status !== 'maintenance' && tool.status !== 'lost' && (
                    <UsageControls siteId={siteId} tool={tool} meterUnit={tool.meter_unit} />
                  )}
                  {!isContractor && !tool.is_active && (
                    <p className="text-xs text-muted-foreground mt-2">Not yet active on site - check with your contractor.</p>
                  )}

                  <button
                    onClick={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
                    className="flex items-center gap-1 text-xs text-primary mt-2"
                  >
                    <History className="w-3 h-3" /> {expandedId === tool.id ? 'Hide' : 'View'} history & maintenance
                  </button>
                  {expandedId === tool.id && <EquipmentHistory toolId={tool.id} siteId={siteId} />}

                  <EquipmentCertifications
                    toolId={tool.id}
                    certs={certs ?? []}
                    isContractor={isContractor}
                    onAdd={() => setCertFormToolId(tool.id)}
                    onEdit={setEditingCert}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddForm && <AddEquipmentForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
      {editingTool && <EditEquipmentForm siteId={siteId} tool={editingTool} onClose={() => setEditingTool(null)} />}
      {certFormToolId && (
        <CertificationForm siteId={siteId} presetToolId={certFormToolId} onClose={() => setCertFormToolId(null)} />
      )}
      {editingCert && <CertificationForm siteId={siteId} existing={editingCert} onClose={() => setEditingCert(null)} />}
    </div>
  );
}