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
  useReviewVariationOrder,
  useVariationOrderResponses,
  useAddVariationOrderResponse,
  type VariationOrder,
} from '@/hooks/useVariationOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

// Raise form: title + description only. Whoever spots the issue on site
// (typically the foreman) reports what happened - pricing it and deciding
// cost/time impact is the contractor's call at review time, not the
// raiser's, so those fields don't belong here.
const raiseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
});
type RaiseFormValues = z.infer<typeof raiseSchema>;

// Review form (contractor only): can refine the title/description the
// foreman wrote and must set cost/time impact before approving or
// rejecting - blank number inputs submit "" which z.coerce.number()
// alone would turn into 0, so blank stays optional/undefined instead of
// silently zeroing a real value out.
const blankToUndefined = (v: unknown) => (v === '' || v === undefined ? undefined : v);
const reviewSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  cost_impact: z.preprocess(blankToUndefined, z.coerce.number().optional()),
  time_impact_days: z.preprocess(blankToUndefined, z.coerce.number().optional()),
});
type ReviewFormInput = z.input<typeof reviewSchema>;
type ReviewFormValues = z.output<typeof reviewSchema>;

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
  } = useForm<RaiseFormValues>({ resolver: zodResolver(raiseSchema) });

  const onSubmit = async (values: RaiseFormValues) => {
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
            <Textarea id="description" rows={4} placeholder="What happened, and why it's outside the original scope..." {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            The contractor will add cost and time impact when they review this.
          </p>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            RAISE VARIATION ORDER
          </Button>
        </form>
      </div>
    </div>
  );
}

// Contractor-only: edit the raised title/description, set cost/time
// impact, and approve or reject - one form, one save. Two submit buttons
// share the same validation; which one was clicked decides approve vs
// reject before calling the same mutation.
function ReviewVOForm({ vo, onDone }: { vo: VariationOrder; onDone: () => void }) {
  const review = useReviewVariationOrder();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewFormInput, unknown, ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      title: vo.title,
      description: vo.description,
      cost_impact: vo.cost_impact ?? undefined,
      time_impact_days: vo.time_impact_days ?? undefined,
    },
  });

  const submitDecision = async (values: ReviewFormValues, approve: boolean) => {
    try {
      await review.mutateAsync({ voId: vo.id, approve, ...values });
      toast.success(approve ? 'Variation approved' : 'Variation rejected');
      onDone();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <form className="mt-3 space-y-3 border-t border-border pt-3" noValidate>
      <div className="space-y-1">
        <Label htmlFor={`title-${vo.id}`} className="text-xs">Title</Label>
        <Input id={`title-${vo.id}`} {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`description-${vo.id}`} className="text-xs">Description</Label>
        <Textarea id={`description-${vo.id}`} rows={3} {...register('description')} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`cost-${vo.id}`} className="text-xs">Cost Impact (KES)</Label>
          <Input id={`cost-${vo.id}`} type="number" step="0.01" {...register('cost_impact')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`time-${vo.id}`} className="text-xs">Time Impact (days)</Label>
          <Input id={`time-${vo.id}`} type="number" {...register('time_impact_days')} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="construction"
          disabled={review.isPending}
          onClick={handleSubmit((values) => submitDecision(values, true))}
        >
          <Check className="w-4 h-4 mr-1" /> Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={review.isPending}
          onClick={handleSubmit((values) => submitDecision(values, false))}
        >
          <XCircle className="w-4 h-4 mr-1" /> Reject
        </Button>
      </div>
    </form>
  );
}

export function VariationOrdersView({ siteId, onClose }: VariationOrdersViewProps) {
  const { isContractor } = useAuth();
  const { data: vos, isLoading } = useSiteVariationOrders(siteId);
  const [showRaiseForm, setShowRaiseForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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
                  reviewingId === vo.id ? (
                    <ReviewVOForm vo={vo} onDone={() => setReviewingId(null)} />
                  ) : (
                    <Button size="sm" variant="construction" className="mt-3" onClick={() => setReviewingId(vo.id)}>
                      Review & Decide
                    </Button>
                  )
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