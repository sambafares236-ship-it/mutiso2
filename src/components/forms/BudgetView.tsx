import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Wallet, X, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteBudget, useCreateBudgetLine } from '@/hooks/useBudget';
import { useSiteActualCosts, useCreateActualCost } from '@/hooks/useActualCosts';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES = ['labor', 'material', 'equipment', 'subcontractor', 'overhead'] as const;

const budgetSchema = z.object({
  category: z.string().min(1),
  cost_code: z.string().optional(),
  budgeted_amount: z.coerce.number().positive('Amount must be greater than 0'),
});
type BudgetFormInput = z.input<typeof budgetSchema>;
type BudgetFormValues = z.output<typeof budgetSchema>;

const costSchema = z.object({
  cost_type: z.string().min(1),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  invoice_reference: z.string().optional(),
  date_incurred: z.string().min(1),
});
type CostFormInput = z.input<typeof costSchema>;
type CostFormValues = z.output<typeof costSchema>;

interface BudgetViewProps {
  siteId: string;
  onClose: () => void;
}

export function BudgetView({ siteId, onClose }: BudgetViewProps) {
  const { user, isContractor } = useAuth();
  const { data: budgetLines, isLoading: budgetLoading } = useSiteBudget(siteId);
  const { data: actualCosts, isLoading: costsLoading } = useSiteActualCosts(siteId);
  const createBudgetLine = useCreateBudgetLine();
  const createActualCost = useCreateActualCost();
  const [tab, setTab] = useState<'budget' | 'actuals'>('budget');
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);

  const budgetForm = useForm<BudgetFormInput, unknown, BudgetFormValues>({ resolver: zodResolver(budgetSchema) });
  const costForm = useForm<CostFormInput, unknown, CostFormValues>({
    resolver: zodResolver(costSchema),
    defaultValues: { date_incurred: new Date().toISOString().split('T')[0] },
  });

  const onSubmitBudget = async (values: BudgetFormValues) => {
    if (!user) return;
    try {
      await createBudgetLine.mutateAsync({
        site_id: siteId,
        created_by: user.id,
        category: values.category,
        budgeted_amount: values.budgeted_amount,
        cost_code: values.cost_code || undefined,
      });
      toast.success('Budget line added');
      budgetForm.reset();
      setShowBudgetForm(false);
    } catch (err) {
      toast.error('Could not add budget line', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const onSubmitCost = async (values: CostFormValues) => {
    if (!user) return;
    try {
      await createActualCost.mutateAsync({
        site_id: siteId,
        created_by: user.id,
        cost_type: values.cost_type,
        amount: values.amount,
        date_incurred: values.date_incurred,
        invoice_reference: values.invoice_reference || undefined,
      });
      toast.success('Actual cost logged');
      costForm.reset({ date_incurred: new Date().toISOString().split('T')[0] });
      setShowCostForm(false);
    } catch (err) {
      toast.error('Could not log cost', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">BUDGET &amp; COSTS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => setTab('budget')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'budget' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Budget
          </button>
          <button
            type="button"
            onClick={() => setTab('actuals')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'actuals' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Actual Costs
          </button>
        </div>

        {tab === 'budget' ? (
          <div className="space-y-3">
            {budgetLoading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : !budgetLines?.length ? (
              <p className="text-sm text-muted-foreground">No budget lines yet.</p>
            ) : (
              budgetLines.map((line) => (
                <div key={line.id} className="card-industrial p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{line.category}</p>
                    {line.cost_code && <p className="text-xs text-muted-foreground">{line.cost_code}</p>}
                  </div>
                  <p className="font-medium text-foreground">{formatKES(line.budgeted_amount)}</p>
                </div>
              ))
            )}

            {isContractor &&
              (showBudgetForm ? (
                <form onSubmit={budgetForm.handleSubmit(onSubmitBudget)} className="p-3 border border-dashed border-border rounded-lg space-y-2" noValidate>
                  <select {...budgetForm.register('category')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Input placeholder="Cost code (optional)" {...budgetForm.register('cost_code')} />
                  <Input type="number" step="0.01" placeholder="Budgeted amount" {...budgetForm.register('budgeted_amount')} />
                  {budgetForm.formState.errors.budgeted_amount && (
                    <p className="text-xs text-destructive">{budgetForm.formState.errors.budgeted_amount.message}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="construction" disabled={budgetForm.formState.isSubmitting}>
                      Add
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowBudgetForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowBudgetForm(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Add budget line
                </Button>
              ))}
          </div>
        ) : (
          <div className="space-y-3">
            {costsLoading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : !actualCosts?.length ? (
              <p className="text-sm text-muted-foreground">No actual costs logged yet.</p>
            ) : (
              actualCosts.map((cost) => (
                <div key={cost.id} className="card-industrial p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{cost.cost_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {cost.date_incurred} {cost.invoice_reference ? `· ${cost.invoice_reference}` : ''}
                    </p>
                  </div>
                  <p className="font-medium text-foreground">{formatKES(cost.amount)}</p>
                </div>
              ))
            )}

            {isContractor &&
              (showCostForm ? (
                <form onSubmit={costForm.handleSubmit(onSubmitCost)} className="p-3 border border-dashed border-border rounded-lg space-y-2" noValidate>
                  <select {...costForm.register('cost_type')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {CATEGORIES.filter((c) => c !== 'labor').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Input type="number" step="0.01" placeholder="Amount" {...costForm.register('amount')} />
                  {costForm.formState.errors.amount && <p className="text-xs text-destructive">{costForm.formState.errors.amount.message}</p>}
                  <Input placeholder="Invoice reference (optional)" {...costForm.register('invoice_reference')} />
                  <div className="space-y-1">
                    <Label className="text-xs">Date incurred</Label>
                    <Input type="date" {...costForm.register('date_incurred')} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="construction" disabled={costForm.formState.isSubmitting}>
                      {costForm.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log cost'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowCostForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowCostForm(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Log actual cost
                </Button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
