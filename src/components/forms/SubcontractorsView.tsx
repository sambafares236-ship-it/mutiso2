import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Users2, X, Plus, Briefcase, Lock, Wallet, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useSiteSubcontractors,
  useAddSubcontractor,
  useSubcontractorCompliance,
  useSubcontractorWorkOrders,
  useAddWorkOrder,
  useCompleteWorkOrder,
  useApproveWorkOrder,
  useSubcontractorPayments,
  useGenerateSubcontractorPayment,
} from '@/hooks/useSubcontractors';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TradeCombobox } from '@/components/forms/TradeCombobox';

const schema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  trade: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  nca_number: z.string().optional(),
  nca_class: z.string().optional(),
  nca_expiry: z.string().optional(),
  insurance_expiry: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const paymentSchema = z.object({
  work_completed_value: z.coerce.number().positive('Amount must be greater than 0'),
  retention_percentage: z.coerce.number().min(0).max(100).optional(),
});
type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentFormValues = z.output<typeof paymentSchema>;

interface SubcontractorsViewProps {
  siteId: string;
  onClose: () => void;
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false;
  const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days < 30;
}

function WorkOrdersList({ subcontractorId, isContractor }: { subcontractorId: string; isContractor: boolean }) {
  const { data: orders } = useSubcontractorWorkOrders(subcontractorId);
  const complete = useCompleteWorkOrder();
  const approve = useApproveWorkOrder();

  if (!orders?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between gap-2 bg-secondary rounded-lg px-3 py-2">
          <div className="flex-1">
            <p className="text-xs text-foreground">{order.description}</p>
            {order.value != null && <p className="text-[10px] text-muted-foreground">{formatKES(order.value)}</p>}
          </div>
          {order.status === 'open' && (
            <Button size="sm" variant="ghost" onClick={() => complete.mutate(order.id)}>
              Mark Done
            </Button>
          )}
          {order.status === 'completed' && isContractor && (
            <Button size="sm" variant="ghost" onClick={() => approve.mutate(order.id)}>
              Approve
            </Button>
          )}
          {order.status === 'completed' && !isContractor && (
            <span className="text-[10px] text-warning uppercase">Awaiting approval</span>
          )}
          {order.status === 'approved' && <span className="text-[10px] text-success uppercase">Approved</span>}
        </div>
      ))}
    </div>
  );
}

// Owner-only: the contractor sets up work orders, the foreman only marks
// them done (see WorkOrdersList) and can never create one - enforced both
// here (the input isn't rendered for a foreman) and server-side (INSERT
// policy on subcontractor_work_order is owner-only).
function AddWorkOrderRow({ siteId, subcontractorId }: { siteId: string; subcontractorId: string }) {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const { data: isCompliant, isLoading: complianceLoading } = useSubcontractorCompliance(subcontractorId);
  const addWorkOrder = useAddWorkOrder();

  const handleAdd = async () => {
    if (!description.trim()) return;
    try {
      await addWorkOrder.mutateAsync({
        site_id: siteId,
        subcontractor_id: subcontractorId,
        description: description.trim(),
        value: value ? Number(value) : undefined,
      });
      setDescription('');
      setValue('');
      toast.success('Work order added');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (complianceLoading) return null;

  if (!isCompliant) {
    return (
      <div className="flex items-start gap-2 mt-2 bg-destructive/10 text-destructive rounded-lg px-3 py-2">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-xs">
          Can't add a new work order — this subcontractor is missing an NCA number or their insurance has expired.
          Update their compliance details first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <Input placeholder="New work order..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs" />
      <Input
        placeholder="Value (KES)"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs w-28"
      />
      <Button size="sm" variant="outline" onClick={handleAdd} disabled={addWorkOrder.isPending}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

// Owner-only. Generates a retention-aware payment via the
// generate_subcontractor_payment RPC, which itself re-checks compliance
// and blocks server-side - this client-side check is just to give a
// clearer message before the round trip.
function PaymentSection({ siteId, subcontractorId }: { siteId: string; subcontractorId: string }) {
  const { data: isCompliant } = useSubcontractorCompliance(subcontractorId);
  const { data: payments } = useSubcontractorPayments(subcontractorId);
  const generate = useGenerateSubcontractorPayment();
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({ resolver: zodResolver(paymentSchema) });

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      await generate.mutateAsync({
        site_id: siteId,
        subcontractor_id: subcontractorId,
        work_completed_value: values.work_completed_value,
        retention_percentage: values.retention_percentage,
      });
      toast.success('Payment generated');
      reset();
      setShowForm(false);
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const latest = payments?.[0];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground flex items-center gap-1">
          <Wallet className="w-3 h-3" /> Payments
        </p>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} disabled={!isCompliant}>
            <Plus className="w-3 h-3 mr-1" /> Generate Payment
          </Button>
        )}
      </div>

      {!isCompliant && (
        <p className="text-[10px] text-destructive mt-1">Fix NCA/insurance compliance before generating a payment.</p>
      )}

      {latest && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Last: #{latest.payment_number} — net {formatKES(latest.net_amount_due)} (retention {latest.retention_percentage}%)
          {latest.withholding_tax_flag && ' — WHT applies'}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 mt-2" noValidate>
          <div>
            <Label htmlFor={`wcv-${subcontractorId}`} className="text-xs">Work completed value (KES)</Label>
            <Input id={`wcv-${subcontractorId}`} type="number" step="0.01" {...register('work_completed_value')} />
            {errors.work_completed_value && (
              <p className="text-[10px] text-destructive">{errors.work_completed_value.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor={`ret-${subcontractorId}`} className="text-xs">Retention % (defaults to contract retention)</Label>
            <Input id={`ret-${subcontractorId}`} type="number" step="0.1" {...register('retention_percentage')} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="construction" disabled={isSubmitting}>
              Generate
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddSubcontractorForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const addSub = useAddSubcontractor();
  const {
    register,
    handleSubmit,
    control,
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
            <Label>Trade</Label>
            <Controller
              name="trade"
              control={control}
              render={({ field }) => (
                <TradeCombobox siteId={siteId} value={field.value} onChange={field.onChange} />
              )}
            />
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
            <Label htmlFor="nca_class">NCA Class</Label>
            <Input id="nca_class" placeholder="NCA1 – NCA8" {...register('nca_class')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nca_expiry">NCA License Expiry</Label>
            <Input id="nca_expiry" type="date" {...register('nca_expiry')} />
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
  const { isContractor } = useAuth();
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

        {isContractor ? (
          <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Subcontractor
          </Button>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
            <Lock className="w-3 h-3" /> Only the site owner can register subcontractors.
          </p>
        )}

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
                    <WorkOrdersList subcontractorId={sub.id} isContractor={isContractor} />
                    {isContractor && <AddWorkOrderRow siteId={siteId} subcontractorId={sub.id} />}
                    {isContractor && <PaymentSection siteId={siteId} subcontractorId={sub.id} />}
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