import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ShieldCheck, X, Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import {
  useSiteCertifications,
  useAddCertification,
  useUpdateCertification,
  useDeleteCertification,
  isExpiringSoon,
  type Certification,
} from '@/hooks/useCertifications';
import { useWorkers } from '@/hooks/useWorkers';
import { useSiteTools } from '@/hooks/useTools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  subject_type: z.enum(['worker', 'equipment']),
  worker_id: z.string().optional(),
  tool_id: z.string().optional(),
  cert_name: z.string().min(1, 'Certification name is required'),
  cert_number: z.string().optional(),
  issued_date: z.string().optional(),
  expiry_date: z.string().min(1, 'Expiry date is required'),
});
type FormValues = z.infer<typeof schema>;

interface CertificationsViewProps {
  siteId: string;
  onClose: () => void;
  readOnly?: boolean;
}

export function CertificationForm({
  siteId,
  existing,
  presetToolId,
  onClose,
}: {
  siteId: string;
  existing?: Certification;
  // Pre-scopes a new certification to one piece of equipment (e.g. opened
  // from that equipment's own card in HeavyEquipmentView) rather than
  // starting from the generic "applies to" picker - only used when
  // `existing` isn't set, since editing already knows its subject.
  presetToolId?: string;
  onClose: () => void;
}) {
  const addCert = useAddCertification();
  const updateCert = useUpdateCertification();
  const { data: workers } = useWorkers(siteId);
  const { data: tools } = useSiteTools(siteId);
  const [subjectType, setSubjectType] = useState<'worker' | 'equipment'>(
    (existing?.subject_type as 'worker' | 'equipment') ?? (presetToolId ? 'equipment' : 'worker'),
  );
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          subject_type: existing.subject_type as 'worker' | 'equipment',
          worker_id: existing.worker_id ?? undefined,
          tool_id: existing.tool_id ?? undefined,
          cert_name: existing.cert_name,
          cert_number: existing.cert_number ?? undefined,
          issued_date: existing.issued_date ?? undefined,
          expiry_date: existing.expiry_date,
        }
      : presetToolId
        ? { subject_type: 'equipment', tool_id: presetToolId }
        : { subject_type: 'worker' },
  });

  const onSubmit = async (values: FormValues) => {
    if (subjectType === 'worker' && !values.worker_id) {
      toast.error('Select a worker');
      return;
    }
    if (subjectType === 'equipment' && !values.tool_id) {
      toast.error('Select equipment');
      return;
    }
    const payload = {
      site_id: siteId,
      subject_type: subjectType,
      worker_id: subjectType === 'worker' ? values.worker_id ?? null : null,
      tool_id: subjectType === 'equipment' ? values.tool_id ?? null : null,
      cert_name: values.cert_name,
      cert_number: values.cert_number,
      issued_date: values.issued_date,
      expiry_date: values.expiry_date,
    };
    try {
      if (existing) {
        await updateCert.mutateAsync({ id: existing.id, ...payload });
        toast.success('Certification updated');
      } else {
        await addCert.mutateAsync(payload);
        toast.success('Certification added');
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
          <h2 className="font-display text-3xl text-primary">{existing ? 'EDIT CERTIFICATION' : 'ADD CERTIFICATION'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Applies to</Label>
            <Select
              value={subjectType}
              onValueChange={(v) => {
                setSubjectType(v as 'worker' | 'equipment');
                setValue('subject_type', v as 'worker' | 'equipment');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worker">Worker</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {subjectType === 'worker' ? (
            <div className="space-y-2">
              <Label>Worker *</Label>
              <Select value={watch('worker_id')} onValueChange={(v) => setValue('worker_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Equipment *</Label>
              <Select value={watch('tool_id')} onValueChange={(v) => setValue('tool_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {tools?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.tool_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cert_name">Certification Name *</Label>
            <Input id="cert_name" placeholder="e.g., First Aid, Crane Inspection" {...register('cert_name')} />
            {errors.cert_name && <p className="text-xs text-destructive">{errors.cert_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert_number">Certificate Number</Label>
            <Input id="cert_number" {...register('cert_number')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issued_date">Issued</Label>
              <Input id="issued_date" type="date" {...register('issued_date')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expiry *</Label>
              <Input id="expiry_date" type="date" {...register('expiry_date')} />
              {errors.expiry_date && <p className="text-xs text-destructive">{errors.expiry_date.message}</p>}
            </div>
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {existing ? 'SAVE CHANGES' : 'ADD CERTIFICATION'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function CertificationsView({ siteId, onClose, readOnly = false }: CertificationsViewProps) {
  const { data: certs, isLoading } = useSiteCertifications(siteId);
  const deleteCert = useDeleteCertification();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);

  const handleDelete = async (cert: Certification) => {
    if (!window.confirm(`Delete "${cert.cert_name}"? This cannot be undone.`)) return;
    try {
      await deleteCert.mutateAsync({ id: cert.id, site_id: siteId });
      toast.success('Certification deleted');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">CERTIFICATIONS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {!readOnly && (
          <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Certification
          </Button>
        )}

        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : !certs?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No certifications tracked yet.</p>
        ) : (
          <div className="space-y-3">
            {certs.map((cert) => {
              const expiring = isExpiringSoon(cert.expiry_date);
              return (
                <div key={cert.id} className={`card-industrial p-4 ${expiring ? 'border-destructive' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{cert.cert_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cert.subject_type === 'worker' ? cert.worker?.full_name : cert.tool?.tool_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {expiring && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                          <AlertTriangle className="w-3 h-3" /> Expiring
                        </span>
                      )}
                      {!readOnly && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCert(cert)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(cert)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Expires {cert.expiry_date}</p>
                  {cert.cert_number && <p className="text-[10px] text-muted-foreground">#{cert.cert_number}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddForm && <CertificationForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
      {editingCert && (
        <CertificationForm siteId={siteId} existing={editingCert} onClose={() => setEditingCert(null)} />
      )}
    </div>
  );
}
