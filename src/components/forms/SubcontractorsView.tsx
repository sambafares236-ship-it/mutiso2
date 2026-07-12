import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Users2, X, Plus, Briefcase } from 'lucide-react';
import {
  useSiteSubcontractors,
  useAddSubcontractor,
  useSubcontractorWorkOrders,
  useAddWorkOrder,
  useCompleteWorkOrder,
} from '@/hooks/useSubcontractors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  trade: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  nca_number: z.string().optional(),
  insurance_expiry: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface SubcontractorsViewProps {
  siteId: string;
  onClose: () => void;
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false;
  const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days < 30;
}

function WorkOrdersList({ subcontractorId }: { subcontractorId: string }) {
  const { data: orders } = useSubcontractorWorkOrders(subcontractorId);
  const complete = useCompleteWorkOrder();

  if (!orders?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between gap-2 bg-secondary rounded-lg px-3 py-2">
          <p className="text-xs text-foreground flex-1">{order.description}</p>
          {order.status === 'open' ? (
            <Button size="sm" variant="ghost" onClick={() => complete.mutate(order.id)}>
              Mark Done
            </Button>
          ) : (
            <span className="text-[10px] text-success uppercase">Done</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AddWorkOrderRow({ siteId, subcontractorId }: { siteId: string; subcontractorId: string }) {
  const [description, setDescription] = useState('');
  const addWorkOrder = useAddWorkOrder();

  const handleAdd = async () => {
    if (!description.trim()) return;
    try {
      await addWorkOrder.mutateAsync({ site_id: siteId, subcontractor_id: subcontractorId, description: description.trim() });
      setDescription('');
      toast.success('Work order added');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Input placeholder="New work order..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs" />
      <Button size="sm" variant="outline" onClick={handleAdd} disabled={addWorkOrder.isPending}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

function AddSubcontractorForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const addSub = useAddSubcontractor();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await addSub.mutateAsync({ site_id: siteId, ...values });
      toast.success('Subcontractor added');
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-primary">ADD SUBCONTRACTOR</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input id="company_name" {...register('company_name')} />
            {errors.company_name && <p className="text-xs text-destructive">{errors.company_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="trade">Trade</Label>
            <Input id="trade" placeholder="Plumbing, Electrical..." {...register('trade')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input id="contact_name" {...register('contact_name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact Phone</Label>
            <Input id="contact_phone" {...register('contact_phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nca_number">NCA Registration Number</Label>
            <Input id="nca_number" {...register('nca_number')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insurance_expiry">Insurance Expiry</Label>
            <Input id="insurance_expiry" type="date" {...register('insurance_expiry')} />
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            ADD SUBCONTRACTOR
          </Button>
        </form>
      </div>
    </div>
  );
}

export function SubcontractorsView({ siteId, onClose }: SubcontractorsViewProps) {
  const { data: subs, isLoading } = useSiteSubcontractors(siteId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Users2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">SUBCONTRACTORS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Subcontractor
        </Button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !subs?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No subcontractors registered.</p>
        ) : (
          <div className="space-y-3">
            {subs.map((sub) => (
              <div key={sub.id} className="card-industrial p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{sub.company_name}</p>
                    <p className="text-xs text-muted-foreground">{sub.trade || 'No trade specified'}</p>
                  </div>
                  {isExpiringSoon(sub.insurance_expiry) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                      Insurance expiring
                    </span>
                  )}
                </div>
                {sub.contact_phone && <p className="text-xs text-muted-foreground mt-1">{sub.contact_phone}</p>}
                <button
                  onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                  className="flex items-center gap-1 text-xs text-primary mt-2"
                >
                  <Briefcase className="w-3 h-3" /> {expandedId === sub.id ? 'Hide' : 'View'} work orders
                </button>
                {expandedId === sub.id && (
                  <>
                    <WorkOrdersList subcontractorId={sub.id} />
                    <AddWorkOrderRow siteId={siteId} subcontractorId={sub.id} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddForm && <AddSubcontractorForm siteId={siteId} onClose={() => setShowAddForm(false)} />}
    </div>
  );
}
