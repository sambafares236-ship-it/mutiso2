import { CheckCircle2, Circle, Clock, Plus, Phone } from 'lucide-react';
import type { OnboardingJourneyState } from '@/hooks/useOnboardingJourney';
import { SiteSetupChecklist } from '@/components/SiteSetupChecklist';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OnboardingJourneyProps {
  journey: OnboardingJourneyState;
  /** Launch the site-creation wizard (guarded: the caller checks needsPhone). */
  onCreateSite: () => void;
  /** Open Settings so the contractor can add the missing phone number. */
  onAddPhone: () => void;
}

/**
 * The persistent "Getting started" tracker for a first-time contractor. Shows
 * the four onboarding phases with the current one highlighted, a per-phase
 * action for whichever one is live, and disappears entirely once the first
 * site is fully running (journey.allDone). All state is derived - see
 * useOnboardingJourney - so there's nothing to dismiss or persist.
 */
export function OnboardingJourney({ journey, onCreateSite, onAddPhone }: OnboardingJourneyProps) {
  if (journey.loading) {
    return (
      <div className="card-industrial p-4 space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-2 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (journey.allDone) return null;

  const { phases, completedCount, totalCount, needsPhone } = journey;

  return (
    <div className="card-industrial p-4 border-2 border-primary/50 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Getting started</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            A few steps to your first running site.
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount} of {totalCount}
        </span>
      </div>

      {/* Same success token the checkmarks use, so "done" reads as one colour. */}
      <div
        className="h-1.5 w-full rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-label={`Onboarding progress: ${completedCount} of ${totalCount} steps complete`}
      >
        <div
          className="h-full bg-success transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <ol className="space-y-3">
        {phases.map((phase) => (
          <li key={phase.id} className="flex items-start gap-2.5">
            {phase.done ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            ) : phase.current ? (
              // A filled ring for "you are here", distinct from a done check and
              // from a not-yet-reached empty circle.
              <span className="w-4 h-4 shrink-0 mt-0.5 rounded-full border-2 border-primary flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              </span>
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm leading-snug',
                  phase.done
                    ? 'text-muted-foreground line-through'
                    : phase.current
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground',
                )}
              >
                {phase.label}
              </p>

              {/* Per-phase action / detail, only for the live phase. */}
              {phase.current && phase.id === 'site' && (
                needsPhone ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Your account has no phone number yet. It&apos;s how the WhatsApp assistant
                      knows it&apos;s you, and a site can&apos;t be created without it.
                    </p>
                    <Button size="sm" variant="construction" onClick={onAddPhone}>
                      <Phone className="w-4 h-4 mr-1" /> Add your phone number
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Button size="sm" variant="construction" onClick={onCreateSite}>
                      <Plus className="w-4 h-4 mr-1" /> Create your first site
                    </Button>
                  </div>
                )
              )}

              {phase.current && phase.id === 'approval' && (
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    We&apos;re confirming your payment and reviewing the site. Full access unlocks
                    once it&apos;s approved.
                  </span>
                </p>
              )}

              {phase.current && phase.id === 'setup' && journey.setupSiteId && journey.setupTier && (
                <div className="mt-2">
                  <SiteSetupChecklist
                    siteId={journey.setupSiteId}
                    siteName={journey.setupSiteName ?? 'your site'}
                    tier={journey.setupTier}
                    embedded
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
