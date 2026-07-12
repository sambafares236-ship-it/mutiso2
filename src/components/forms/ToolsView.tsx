import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Wrench, X, Plus, History } from 'lucide-react';
import {
  useSiteTools,
  useAddTool,
  useCheckoutTool,
  useReturnTool,
  useToolCheckoutHistory,
  useToolMaintenanceLogs,
  useAddMaintenanceLog,
} from '@/hooks/useTools';
import { useWorkers } from '@/hooks/useWorkers';
import { useTodayAttendance } from '@/hooks/useAttendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const addToolSchema = z.object({
  tool_name: z.string().min(1, 'Tool name is required'),
  tool_id_number: z.string().optional(),
});
type AddToolValues = z.infer<typeof addToolSchema>;

interface ToolsViewProps {
  siteId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  checked_out: 'Checked out',
  maintenance: 'In maintenance',
  lost: 'Lost',
};

const STATUS_STYLES: Record<string, string> = {
  available: 'text-success',
  checked_out: 'text-warning',
  maintenance: 'text-blue-400',
  lost: 'text-destructive',
};

function CheckoutRow({ siteId, toolId }: { siteId: string; toolId: string }) {
  const { data: workers } = useWorkers(siteId);
  const { data: presentIds } = useTodayAttendance(siteId);
  const [workerId, setWorkerId] = useState<string>('');
  const checkout = useCheckoutTool();

  // "Who is in" is enforced server-side too (checkout_tool rejects anyone
  // without a today's attendance_log row) - filtering the picker to
  // present workers here is just so the foreman never sees a name they'd
  // immediately get rejected for picking.
  const presentWorkers = (workers ?? []).filter((w) => presentIds?.has(w.id));

  const handleCheckout = async () => {
    if (!workerId) return;
    try {
      const result = await checkout.mutateAsync({ toolId, workerId });
      setWorkerId('');
      toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline' : 'Tool checked out');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (!presentWorkers.length) {
    return <p className="text-xs text-muted-foreground mt-2">No workers marked present today yet - mark attendance first to check out tools.</p>;
  }

  return (
    <div className="flex gap-2 mt-2">
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
  );
}

function ReturnRow({ toolId }: { toolId: string }) {
  const [notes, setNotes] = useState('');
  const returnTool = useReturnTool();

  const handleReturn = async () => {
    try {
      const result = await returnTool.mutateAsync({ toolId, conditionOnReturn: notes.trim() || undefined });
      setNotes('');
      toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline' : 'Tool returned');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Input placeholder="Condition notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
      <Button size="sm" variant="outline" onClick={handleReturn} disabled={returnTool.isPending}>
        Return
      </Button>
    </div>
  );
}

// Exported so HeavyEquipmentView can reuse it - maintenance logging
// applies to plant items regardless of which screen you're viewing them
// from.
export function MaintenanceSection({ siteId, toolId }: { siteId: string; toolId: string }) {
  const { data: logs, isLoading } = useToolMaintenanceLogs(toolId);
  const addLog = useAddMaintenanceLog();
  const [type, setType] = useState('service');
  const [description, setDescription] = useState('');

  const handleAdd = async () => {
    try {
      await addLog.mutateAsync({
        site_id: siteId,
        tool_id: toolId,
        maintenance_type: type,
        description: description.trim() || undefined,
        performed_at: new Date().toISOString().split('T')[0],
      });
      setDescription('');
      toast.success('Maintenance logged');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Maintenance log</p>
      {isLoading ? (
        <Skeleton className="h-8 w-full rounded-lg" />
      ) : !logs?.length ? (
        <p className="text-xs text-muted-foreground">No maintenance logged yet.</p>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="bg-secondary rounded-lg px-3 py-2">
            <p className="text-xs text-foreground capitalize">
              {log.maintenance_type} — {log.performed_at}
            </p>
            {log.description && <p className="text-[10px] text-muted-foreground">{log.description}</p>}
          </div>
        ))
      )}
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="repair">Repair</SelectItem>
            <SelectItem value="inspection">Inspection</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Notes..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs" />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={addLog.isPending}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function AddToolForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const addTool = useAddTool();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddToolValues>({ resolver: zodResolver(addToolSchema) });

  const onSubmit = async (values: AddToolValues) => {
    try {
      // Hand tools only here - heavy plant has its own Add Equipment form
      // on the Heavy Equipment screen now.
      const result = await addTool.mutateAsync({ site_id: siteId, ...values, category: 'tool' });
      if (result.queued) {
        toast.info('Saved offline', { description: `${values.tool_name} will sync once online.` });
      } else {
        toast.success('Tool added');
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
          <h2 className="font-display text-3xl text-primary">ADD TOOL</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="tool_name">Tool Name *</Label>
            <Input id="tool_name" placeholder="e.g., Angle Grinder, Spirit Level" {...register('tool_name')} />
            {errors.tool_name && <p className="text-xs text-destructive">{errors.tool_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tool_id_number">Asset Tag / ID Number</Label>
            <Input id="tool_id_number" placeholder="e.g., TL-014" {...register('tool_id_number')} />
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            ADD TOOL
          </Button>
        </form>
      </div>
    </div>
  );
}

export function ToolsView({ siteId, onClose }: ToolsViewProps) {
  const { data: allTools, isLoading } = useSiteTools(siteId);
  // Hand tools only - heavy plant moved to its own Heavy Equipment screen
  // with real usage/maintenance tracking, not just a category label.
  const tools = allTools?.filter((t) => t.category !== 'plant');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">TOOLS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Tool
        </Button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !tools?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tools registered.</p>
        ) : (
          <div className="space-y-3">
            {tools.map((tool) => (
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

                {tool.status === 'available' && <CheckoutRow siteId={siteId} toolId={tool.id} />}
                {tool.status === 'checked_out' && <ReturnRow toolId={tool.id} />}

                <button
                  onClick={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
                  className="flex items-center gap-1 text-xs text-primary mt-2"
                >
                  <History className="w-3 h-3" /> {expandedId === tool.id ? 'Hide' : 'View'} history
                </button>
                {expandedId === tool.id && <ToolHistory toolId={tool.id} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddForm && <AddToolForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
    </div>
  );
}

function ToolHistory({ toolId }: { toolId: string }) {
  const { data: history, isLoading } = useToolCheckoutHistory(toolId);

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Checkout history</p>
        {isLoading ? (
          <Skeleton className="h-8 w-full rounded-lg" />
        ) : !history?.length ? (
          <p className="text-xs text-muted-foreground">No checkout history yet.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-xs text-foreground">{h.checked_out_to}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(h.checked_out_at).toLocaleDateString('en-KE')}
                {h.returned_at ? ` → returned ${new Date(h.returned_at).toLocaleDateString('en-KE')}` : ' · still out'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
