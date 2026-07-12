import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Leaf, X, Plus, ImagePlus, CheckCircle2 } from 'lucide-react';
import { useSiteWasteLog, useAddWasteEntry } from '@/hooks/useWasteLog';
import { useSiteIncidents, useReportIncident, useCloseIncident } from '@/hooks/useIncidents';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EnvironmentalViewProps {
  siteId: string;
  onClose: () => void;
}

// dust/noise/spill/environmental report into incident_log (Stage 3) rather
// than a dedicated table - see the waste_log migration comment for why.
const ENV_INCIDENT_CATEGORIES = ['dust', 'noise', 'spill', 'environmental'] as const;
const ENV_CATEGORY_LABELS: Record<string, string> = {
  dust: 'Dust',
  noise: 'Noise',
  spill: 'Spill',
  environmental: 'Other environmental',
};

const wasteSchema = z.object({
  date: z.string().min(1),
  waste_type: z.string().min(1),
  disposal_method: z.string().min(1),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  disposal_partner: z.string().optional(),
});
type WasteFormInput = z.input<typeof wasteSchema>;
type WasteFormValues = z.output<typeof wasteSchema>;

function AddWasteForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const addEntry = useAddWasteEntry();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<WasteFormInput, unknown, WasteFormValues>({
    resolver: zodResolver(wasteSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], waste_type: 'construction_debris', disposal_method: 'licensed_transporter' },
  });

  const onSubmit = async (values: WasteFormValues) => {
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          const ext = photoFile.name.split('.').pop() ?? 'jpg';
          const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, photoFile);
          if (uploadError) throw uploadError;
          photoUrl = path;
        } catch {
          toast.warning('Photo not uploaded', { description: 'Entry will still be logged without it.' });
        }
      }

      const result = await addEntry.mutateAsync({ site_id: siteId, ...values, photo_url: photoUrl });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Waste entry will sync once online.' });
      } else {
        toast.success('Waste entry logged');
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
          <h2 className="font-display text-3xl text-primary">LOG WASTE DISPOSAL</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waste_type">Waste Type</Label>
            <Controller
              name="waste_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="waste_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction_debris">Construction Debris</SelectItem>
                    <SelectItem value="general">General Waste</SelectItem>
                    <SelectItem value="hazardous">Hazardous</SelectItem>
                    <SelectItem value="e_waste">E-Waste</SelectItem>
                    <SelectItem value="scrap_metal">Scrap Metal</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disposal_method">Disposal Method</Label>
            <Controller
              name="disposal_method"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="disposal_method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="licensed_transporter">Licensed Transporter</SelectItem>
                    <SelectItem value="recycling">Recycling</SelectItem>
                    <SelectItem value="landfill">Landfill</SelectItem>
                    <SelectItem value="reuse_onsite">Reuse On-Site</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" step="0.01" placeholder="0" {...register('quantity')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="kg, tonnes, m³, truckloads" {...register('unit')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="disposal_partner">Disposal Partner</Label>
            <Input id="disposal_partner" placeholder="NEMA-licensed handler/transporter name" {...register('disposal_partner')} />
          </div>
          <div className="space-y-2">
            <Label>Evidence Photo (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{photoFile ? photoFile.name : 'Attach disposal note / waybill photo'}</span>
            </button>
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            LOG WASTE ENTRY
          </Button>
        </form>
      </div>
    </div>
  );
}

const envIncidentSchema = z.object({
  category: z.string().min(1),
  severity: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1),
});
type EnvIncidentFormValues = z.infer<typeof envIncidentSchema>;

function AddEnvIncidentForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const reportIncident = useReportIncident();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EnvIncidentFormValues>({
    resolver: zodResolver(envIncidentSchema),
    defaultValues: { category: 'dust', severity: 'low', date: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (values: EnvIncidentFormValues) => {
    try {
      const result = await reportIncident.mutateAsync({ site_id: siteId, ...values });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Report will sync once online.' });
      } else {
        toast.success('Environmental incident reported', {
          description: values.severity !== 'low' ? 'The contractor has been notified.' : 'Report saved.',
        });
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
          <h2 className="font-display text-3xl text-primary">REPORT ENVIRONMENTAL ISSUE</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENV_INCIDENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ENV_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium — notifies contractor</SelectItem>
                    <SelectItem value="high">High — notifies contractor</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">What happened? *</Label>
            <Textarea id="description" rows={4} placeholder="Describe the issue..." {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            SUBMIT REPORT
          </Button>
        </form>
      </div>
    </div>
  );
}

function WasteLogSection({ siteId }: { siteId: string }) {
  const { data: entries, isLoading } = useSiteWasteLog(siteId);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div>
      <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
        <Plus className="w-4 h-4 mr-1" /> Log Waste Entry
      </Button>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !entries?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No waste entries logged yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="card-industrial p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground capitalize">{entry.waste_type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{entry.date}</p>
              </div>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                {entry.disposal_method.replace(/_/g, ' ')}
                {entry.quantity ? ` · ${entry.quantity}${entry.unit ? ` ${entry.unit}` : ''}` : ''}
              </p>
              {entry.disposal_partner && <p className="text-xs text-muted-foreground">Partner: {entry.disposal_partner}</p>}
            </div>
          ))}
        </div>
      )}
      {showAddForm && <AddWasteForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  low: 'border-border',
  medium: 'border-warning',
  high: 'border-destructive',
};

function EnvIncidentsSection({ siteId }: { siteId: string }) {
  const { data: allIncidents, isLoading } = useSiteIncidents(siteId);
  const closeIncident = useCloseIncident();
  const [showAddForm, setShowAddForm] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [correctiveAction, setCorrectiveAction] = useState('');

  const incidents = (allIncidents ?? []).filter((i) => (ENV_INCIDENT_CATEGORIES as readonly string[]).includes(i.category));

  const handleClose = async (incidentId: string) => {
    if (!correctiveAction.trim()) return;
    try {
      await closeIncident.mutateAsync({ incidentId, correctiveAction: correctiveAction.trim() });
      setClosingId(null);
      setCorrectiveAction('');
      toast.success('Incident closed');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div>
      <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
        <Plus className="w-4 h-4 mr-1" /> Report Issue
      </Button>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !incidents.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No environmental incidents reported.</p>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.id} className={`rounded-xl border-2 p-4 ${SEVERITY_STYLES[incident.severity]}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-foreground">{ENV_CATEGORY_LABELS[incident.category] ?? incident.category}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{incident.severity}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{incident.description}</p>
              {incident.closed_at ? (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Closed — {incident.corrective_action}
                </p>
              ) : closingId === incident.id ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Corrective action taken..."
                    value={correctiveAction}
                    onChange={(e) => setCorrectiveAction(e.target.value)}
                    className="text-xs"
                  />
                  <Button size="sm" variant="construction" onClick={() => handleClose(incident.id)} disabled={closeIncident.isPending}>
                    Close
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setClosingId(incident.id)}>
                  Mark Resolved
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {showAddForm && <AddEnvIncidentForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
    </div>
  );
}

export function EnvironmentalView({ siteId, onClose }: EnvironmentalViewProps) {
  const [tab, setTab] = useState<'waste' | 'incidents'>('waste');

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Leaf className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">ENVIRONMENTAL</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Button variant={tab === 'waste' ? 'construction' : 'outline'} size="sm" onClick={() => setTab('waste')}>
            Waste Log
          </Button>
          <Button variant={tab === 'incidents' ? 'construction' : 'outline'} size="sm" onClick={() => setTab('incidents')}>
            Incidents
          </Button>
        </div>

        {tab === 'waste' ? <WasteLogSection siteId={siteId} /> : <EnvIncidentsSection siteId={siteId} />}
      </div>
    </div>
  );
}
