import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FileEdit, X, Plus, Check, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useSiteVariationOrders,
  useRaiseVariationOrder,
  useDecideVariationOrder,
  useVariationOrderResponses,
  useAddVariationOrderResponse,
} from '@/hooks/useVariationOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  cost_impact: z.coerce.number().optional(),
  time_impact_days: z.coerce.number().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface VariationOrdersViewProps {
  siteId: string;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'border-warning bg-warning/10',
  approved: 'border-success bg-success/10',
  rejected: 'border-destructive bg-destructive/10',
};

function ResponseThread({ voId }: { voId: string }) {
  const { data: responses } = useVariationOrderResponses(voId);
  const addResponse = useAddVariationOrderResponse();
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      await addResponse.mutateAsync({ voId, message: message.trim() });
      setMessage('');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {responses?.map((r) => (
        <p key={r.id} className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
          {r.message}
        </p>
      ))}
      <div className="flex gap-2">
        <Input placeholder="Add a response..." value={message} onChange={(e) => setMessage(e.target.value)} className="text-xs" />
        <Button size="sm" variant="outline" onClick={handleSend} disabled={addResponse.isPending}>
          Send
        </Button>
      </div>
    </div>
  );
}

function RaiseVOForm({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const raise = useRaiseVariationOrder();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await raise.mutateAsync({ site_id: siteId, ...values });
      toast.success('Variation order raised');
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-primary">RAISE VARIATION</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="e.g., Additional foundation piling" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" rows={4} {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_impact">Cost Impact (KES)</Label>
              <Input id="cost_impact" type="number" {...register('cost_impact')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time_impact_days">Time Impact (days)</Label>
              <Input id="time_impact_days" type="number" {...register('time_impact_days')} />
            </div>
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            RAISE VARIATION ORDER
          </Button>
        </form>
      </div>
    </div>
  );
}

export function VariationOrdersView({ siteId, onClose }: VariationOrdersViewProps) {
  const { isContractor } = useAuth();
  const { data: vos, isLoading } = useSiteVariationOrders(siteId);
  const decide = useDecideVariationOrder();
  const [showRaiseForm, setShowRaiseForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDecide = async (voId: string, approve: boolean) => {
    try {
      await decide.mutateAsync({ voId, approve });
      toast.success(approve ? 'Variation approved' : 'Variation rejected');
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
              <FileEdit className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">VARIATIONS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowRaiseForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Raise Variation
        </Button>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : !vos?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No variation orders yet.</p>
        ) : (
          <div className="space-y-3">
            {vos.map((vo) => (
              <div key={vo.id} className={`rounded-xl border-2 p-4 ${STATUS_STYLES[vo.status]}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground">{vo.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{vo.status}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{vo.description}</p>
                {(vo.cost_impact || vo.time_impact_days) && (
                  <p className="text-xs text-muted-foreground">
                    {vo.cost_impact ? `KES ${vo.cost_impact}` : ''}
                    {vo.cost_impact && vo.time_impact_days ? ' · ' : ''}
                    {vo.time_impact_days ? `${vo.time_impact_days} day(s)` : ''}
                  </p>
                )}

                {vo.status === 'open' && isContractor && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="construction" onClick={() => handleDecide(vo.id, true)} disabled={decide.isPending}>
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDecide(vo.id, false)} disabled={decide.isPending}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}

                <button onClick={() => setExpandedId(expandedId === vo.id ? null : vo.id)} className="text-xs text-primary mt-2">
                  {expandedId === vo.id ? 'Hide' : 'View'} discussion
                </button>
                {expandedId === vo.id && <ResponseThread voId={vo.id} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {showRaiseForm && <RaiseVOForm siteId={siteId} onClose={() => setShowRaiseForm(false)} />}
    </div>
  );
}
