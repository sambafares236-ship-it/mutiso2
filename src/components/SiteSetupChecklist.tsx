import { CheckCircle2, Circle } from 'lucide-react';
import { useSiteSetupProgress } from '@/hooks/useSiteSetupProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SiteSetupChecklistProps {
  siteId: string;
  siteName: string;
  /** Gates the Pro-only schedule step - see useSiteSetupProgress. */
  tier: 'field_ops' | 'pro';
}

/**
 * First-run guidance for a freshly-activated site.
 *
 * Disappears on its own once all four steps are done - it is scaffolding for
 * the first day, not a permanent dashboard fixture, so there's deliberately no
 * dismiss control to manage or persist.
 */
export function SiteSetupChecklist({ siteId, siteName, tier }: SiteSetupChecklistProps) {
  const { data, isLoading } = useSiteSetupProgress(siteId, tier);

  if (isLoading) {
    return (
      <div className="card-industrial p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.allDone) return null;

  const { steps, completedCount } = data;
  const total = steps.length;

  return (
    <div className="card-industrial p-4 border-2 border-primary/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Set up {siteName}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            A few things to do before the app can work for you.
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount} of {total}
        </span>
      </div>

      {/* Progress bar - same success token the checkmarks use, so "done" reads
          as one colour across the card. */}
      <div
        className="h-1.5 w-full rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Setup progress: ${completedCount} of ${total} steps complete`}
      >
        <div
          className="h-full bg-success transition-all duration-500"
          style={{ width: `${(completedCount / total) * 100}%` }}
        />
      </div>

      <ul className="space-y-2.5 pt-1">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5">
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  'text-sm leading-snug',
                  step.done ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
