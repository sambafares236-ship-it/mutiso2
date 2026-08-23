import { HardHat, Building, ShieldCheck, ClipboardList, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  /** Contractor's name, for a personal greeting. Falls back gracefully. */
  name: string | null;
  /** Primary CTA - start creating the first site (caller guards on phone). */
  onStart: () => void;
  /** Dismiss without starting; the tracker underneath carries them from here. */
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: Building,
    title: 'Create & pay for your site',
    body: 'Pick a plan and pay via M-Pesa. One subscription per site.',
  },
  {
    icon: ShieldCheck,
    title: 'We approve it',
    body: 'We confirm your payment and activate the site, usually the same day.',
  },
  {
    icon: ClipboardList,
    title: 'Set it up',
    body: 'Add your workers, invite your foreman, and log the first day on site.',
  },
];

/**
 * One-time orientation shown to a brand-new contractor on first sign-in (no
 * sites yet). Sets the three-step expectation before dropping them into the
 * flow; after this, the persistent "Getting started" tracker drives each step.
 * "Seen" is a per-user localStorage flag set by the caller - no DB state.
 */
export function WelcomeScreen({ name, onStart, onDismiss }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="container max-w-lg mx-auto px-4 py-8 min-h-full flex flex-col">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Close">
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div className="p-4 bg-primary/20 rounded-2xl">
            <HardHat className="w-9 h-9 text-primary" />
          </div>
          <h2 className="font-display text-3xl text-primary">
            {name ? `WELCOME, ${name.toUpperCase()}` : 'WELCOME TO JENGAOPS'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Here&apos;s how to get your first site running. Three steps.
          </p>
        </div>

        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card-industrial p-4 flex items-start gap-3">
              <div className="relative shrink-0">
                <div className="p-2.5 bg-secondary rounded-xl">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 space-y-2">
          <Button variant="construction" size="touch" className="w-full" onClick={onStart}>
            Create your first site <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full" onClick={onDismiss}>
            I&apos;ll do this later
          </Button>
        </div>
      </div>
    </div>
  );
}
