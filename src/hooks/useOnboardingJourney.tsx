import type { Site } from '@/hooks/useSite';
import type { Profile } from '@/hooks/useProfile';
import { useSiteSetupProgress } from '@/hooks/useSiteSetupProgress';
import { isSubscriptionExpired } from '@/hooks/useSubscriptionPayment';

export type JourneyPhaseId = 'account' | 'site' | 'approval' | 'setup';

export interface JourneyPhase {
  id: JourneyPhaseId;
  label: string;
  done: boolean;
  /** The first not-done phase - the one the contractor should act on now. */
  current: boolean;
}

export interface OnboardingJourneyState {
  phases: JourneyPhase[];
  currentPhase: JourneyPhaseId | null;
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  loading: boolean;
  /**
   * The 'site' phase is current but the contractor has no phone number.
   * create_site_with_manual_payment() raises without one ("Add a phone number
   * to your profile before creating a site"), so the tracker prompts them to
   * set it first rather than letting the wizard dead-end at its final button.
   * Only ever true once the profile has actually loaded - we never warn on a
   * pending fetch.
   */
  needsPhone: boolean;
  /** The active, non-expired site the setup phase speaks for (if any). */
  setupSiteId: string | null;
  setupSiteName: string | null;
  setupTier: 'field_ops' | 'pro' | null;
}

/**
 * Derives a first-time contractor's onboarding position from data that already
 * exists - the sites list, the profile, and the per-site setup progress - so
 * there is nothing new to persist and no way for the tracker to drift out of
 * sync with reality. It disappears on its own once the first site is running.
 *
 * The four phases:
 *   account   always done (they're a signed-in contractor)
 *   site      done once they own >=1 site (a site can't exist without a payment
 *             row beside it, so "created" and "paid" are one step)
 *   approval  done once any site reaches status = 'active'
 *   setup     done once the first non-expired active site's checklist is
 *             complete - OR the contractor plainly finished onboarding earlier
 *             and has since lapsed (an active site exists but every active site
 *             is expired). In that lapsed case the expired-subscription banner
 *             is the right message, not a resurrected setup checklist, so we
 *             treat setup as done and let the whole tracker retire.
 */
export function useOnboardingJourney(
  sites: Site[] | undefined,
  sitesLoading: boolean,
  profile: Profile | null | undefined,
  profileLoading: boolean,
): OnboardingJourneyState {
  const list = sites ?? [];
  const hasSite = list.length > 0;
  const hasActiveSite = list.some((s) => s.status === 'active');
  const setupSite = list.find(
    (s) => s.status === 'active' && !isSubscriptionExpired(s.subscription_end),
  );
  const setupTier = (setupSite?.subscription_tier as 'field_ops' | 'pro' | undefined) ?? undefined;

  // Only pulls a query once there is a non-expired active site to speak for;
  // otherwise `enabled: false` keeps it idle (see useSiteSetupProgress).
  const setup = useSiteSetupProgress(setupSite?.id, setupTier);

  const setupDone = (!!setupSite && !!setup.data?.allDone) || (hasActiveSite && !setupSite);

  const base: Omit<JourneyPhase, 'current'>[] = [
    { id: 'account', label: 'Create your account', done: true },
    { id: 'site', label: 'Create & pay for your site', done: hasSite },
    { id: 'approval', label: 'Approved & activated', done: hasActiveSite },
    { id: 'setup', label: 'Set up your site', done: setupDone },
  ];

  const currentIndex = base.findIndex((p) => !p.done);
  const currentPhase = currentIndex === -1 ? null : base[currentIndex].id;

  const phases: JourneyPhase[] = base.map((p, i) => ({ ...p, current: i === currentIndex }));
  const completedCount = base.filter((p) => p.done).length;

  const needsPhone =
    currentPhase === 'site' && !profileLoading && !!profile && !profile.phone_number;

  const loading = sitesLoading || (currentPhase === 'setup' && setup.isLoading);

  return {
    phases,
    currentPhase,
    completedCount,
    totalCount: base.length,
    allDone: currentPhase === null,
    loading,
    needsPhone,
    setupSiteId: setupSite?.id ?? null,
    setupSiteName: setupSite?.site_name ?? null,
    setupTier: setupTier ?? null,
  };
}
