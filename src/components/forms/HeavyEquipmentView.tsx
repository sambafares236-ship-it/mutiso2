import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Truck, X, Plus, History, Gauge, TrendingUp, Wrench } from 'lucide-react';
import {
  useSiteTools,
  useAddTool,
  useCheckoutTool,
  useReturnTool,
  useToolCheckoutHistory,
  useEquipmentEfficiency,
} from '@/hooks/useTools';
import { useWorkers } from '@/hooks/useWorkers';
import { useTodayAttendance } from '@/hooks/useAttendance';
import { useAuth } from '@/hooks/useAuth';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaintenanceSection } from './ToolsView';

interface HeavyEquipmentViewProps {
  siteId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  checked_out: 'In use',
  maintenance: 'In maintenance',
  lost: 'Lost',
};

const STATUS_STYLES: Record<string, string> = {
  available: 'text-success',
  checked_out: 'text-warning',
  maintenance: 'text-blue-400',
  lost: 'text-destructive',
};

const addEquipmentSchema = z.object({
  tool_name: z.string().min(1, 'Equipment name is required'),
  tool_id_number: z.string().optional(),
  meter_unit: z.string().optional(),
});
type AddEquipmentValues = z.infer<typeof addEquipmentSchema>;

function AddEquipmentForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const addTool = useAddTool();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddEquipmentValues>({ resolver: zodResolver(addEquipmentSchema), defaultValues: { meter_unit: 'none' } });

  const onSubmit = async (values: AddEquipmentValues) => {
    try {
      const result = await addTool.mutateAsync({
        site_id: siteId,
        tool_name: values.tool_name,
        tool_id_number: values.tool_id_number,
        category: 'plant',
        meter_unit: values.meter_unit === 'none' ? undefined : values.meter_unit,
      });
      if (result.queued) {
        toast.info('Saved offline', { description: `${values.tool_name} will sync once online.` });
      } else {
        toast.success('Equipment added');
      }
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
            <p className="text-xs text-muted-foreground">Only if this item has a meter you can read at checkout/return.</p>
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            ADD EQUIPMENT
          </Button>
        </form>
      </div>
    </div>
  );
}

function CheckoutRow({ siteId, toolId, meterUnit }: { siteId: string; toolId: string; meterUnit: string | null }) {
  const { data: workers } = useWorkers(siteId);
  const { data: presentIds } = useTodayAttendance(siteId);
  const [workerId, setWorkerId] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const checkout = useCheckoutTool();

  const presentWorkers = (workers ?? []).filter((w) => presentIds?.has(w.id));

  const handleCheckout = async () => {
    if (!workerId) return;
    try {
      const result = await checkout.mutateAsync({
        toolId,
        workerId,
        meterReading: meterReading ? Number(meterReading) : undefined,
      });
      setWorkerId('');
      setMeterReading('');
      toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline' : 'Equipment checked out');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (!presentWorkers.length) {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        No workers marked present today yet - mark attendance first to check out equipment.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2">
        <Select value={workerId} onValueChange={setWorkerId}>
          <SelectTrigger className="text-xs h-9">
            <SelectValue placeholder="Checked out to..." />
          </SelectTrigger>
          <SelectContent>
            {presentWorkers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="construction" onClick={handleCheckout} disabled={checkout.isPending || !workerId}>
          Check out
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

function ReturnRow({ toolId, meterUnit }: { toolId: string; meterUnit: string | null }) {
  const [notes, setNotes] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const returnTool = useReturnTool();

  const handleReturn = async () => {
    try {
      const result = await returnTool.mutateAsync({
        toolId,
        conditionOnReturn: notes.trim() || undefined,
        meterReading: meterReading ? Number(meterReading) : undefined,
      });
      setNotes('');
      setMeterReading('');
      toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline' : 'Equipment returned');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2">
        <Input placeholder="Condition notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
        <Button size="sm" variant="outline" onClick={handleReturn} disabled={returnTool.isPending}>
          Return
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

function EfficiencyStats({
  utilizationPercent,
  costPerHour,
  maintenanceDue,
  nextDueDate,
}: {
  utilizationPercent: number;
  costPerHour: number | null;
  maintenanceDue: boolean;
  nextDueDate: string | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-2 mb-2">
      <div className="bg-secondary/60 rounded-lg p-2 text-center">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
          <Gauge className="w-3 h-3" /> Utilization
        </p>
        <p className="text-sm font-bold text-foreground">{utilizationPercent.toFixed(0)}%</p>
        <p className="text-[9px] text-muted-foreground">last 30 days</p>
      </div>
      <div className="bg-secondary/60 rounded-lg p-2 text-center">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
          <TrendingUp className="w-3 h-3" /> Cost/hr
        </p>
        <p className="text-sm font-bold text-foreground">{costPerHour !== null ? formatKES(costPerHour) : '—'}</p>
        <p className="text-[9px] text-muted-foreground">all-time</p>
      </div>
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

function EquipmentHistory({ toolId, siteId }: { toolId: string; siteId: string }) {
  const { data: history, isLoading } = useToolCheckoutHistory(toolId);

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usage history</p>
        {isLoading ? (
          <Skeleton className="h-8 w-full rounded-lg" />
        ) : !history?.length ? (
          <p className="text-xs text-muted-foreground">No usage history yet.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-xs text-foreground">{h.checked_out_to}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(h.checked_out_at).toLocaleDateString('en-KE')}
                {h.returned_at ? ` → returned ${new Date(h.returned_at).toLocaleDateString('en-KE')}` : ' · still out'}
              </p>
              {(h.meter_reading_out || h.meter_reading_in) && (
                <p className="text-[10px] text-muted-foreground">
                  Meter: {h.meter_reading_out ?? '—'} → {h.meter_reading_in ?? '—'}
                </p>
              )}
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
  const equipment = allTools?.filter((t) => t.category === 'plant');
  const { data: efficiency } = useEquipmentEfficiency(siteId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

        {!isContractor && (
          <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Equipment
          </Button>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : !equipment?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No heavy equipment registered.</p>
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
                    <span className={`text-xs font-medium ${STATUS_STYLES[tool.status]}`}>{STATUS_LABELS[tool.status]}</span>
                  </div>
                  {tool.current_holder_name && (
                    <p className="text-xs text-muted-foreground mt-1">With: {tool.current_holder_name}</p>
                  )}

                  {stats && (
                    <EfficiencyStats
                      utilizationPercent={stats.utilizationPercent}
                      costPerHour={stats.costPerHour}
                      maintenanceDue={stats.maintenanceDue}
                      nextDueDate={stats.nextDueDate}
                    />
                  )}

                  {!isContractor && tool.status === 'available' && (
                    <CheckoutRow siteId={siteId} toolId={tool.id} meterUnit={tool.meter_unit} />
                  )}
                  {!isContractor && tool.status === 'checked_out' && <ReturnRow toolId={tool.id} meterUnit={tool.meter_unit} />}

                  <button
                    onClick={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
                    className="flex items-center gap-1 text-xs text-primary mt-2"
                  >
                    <History className="w-3 h-3" /> {expandedId === tool.id ? 'Hide' : 'View'} history & maintenance
                  </button>
                  {expandedId === tool.id && <EquipmentHistory toolId={tool.id} siteId={siteId} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddForm && <AddEquipmentForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
    </div>
  );
}
