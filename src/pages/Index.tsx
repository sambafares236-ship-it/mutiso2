import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LogOut, Building, Link as LinkIcon, Copy, Check, ShieldCheck, X as XIcon, FileCheck, LayoutDashboard, HardHat, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminSites, useCreateSite, useSiteForeman } from '@/hooks/useSite';
import { useCreateInvite, useSiteInvites } from '@/hooks/useInvite';
import { usePendingSites, useApproveSite, useRejectSite } from '@/hooks/useSuperAdmin';
import { useSitePermits, useDecidePermit, PERMIT_TYPE_LABELS } from '@/hooks/usePermits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import ForemanDashboard from './ForemanDashboard';
import { ProjectOverviewView } from '@/components/forms/ProjectOverviewView';
import { PaySubscriptionDialog } from '@/components/forms/PaySubscriptionDialog';

const createSiteSchema = z.object({
  site_name: z.string().min(1, 'Site name is required'),
  location: z.string().optional(),
});
type CreateSiteValues = z.infer<typeof createSiteSchema>;

function RoleBadge() {
  const { isSuperAdmin, isContractor, isForeman } = useAuth();
  const label = isSuperAdmin ? 'SUPER ADMIN' : isContractor ? 'CONTRACTOR' : isForeman ? 'FOREMAN' : 'ADMIN';
  return (
    <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
      {label}
    </span>
  );
}

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteRow({ siteId, siteName }: { siteId: string; siteName: string }) {
  const createInvite = useCreateInvite();
  const { data: invites } = useSiteInvites(siteId);
  const { data: foreman, isLoading: foremanLoading } = useSiteForeman(siteId);
  const [copied, setCopied] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) });

  const onSubmit = async (values: InviteValues) => {
    try {
      await createInvite.mutateAsync({ site_id: siteId, email: values.email, site_name: siteName });
      toast.success('Invite created', { description: `Sent to ${values.email}.` });
      reset();
      setShowForm(false);
    } catch (err) {
      toast.error('Could not create invite', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  if (foremanLoading) {
    return <Skeleton className="h-9 w-full mt-3 rounded-lg" />;
  }

  // A site with an active foreman assignment can't take another invite -
  // the DB enforces this (site_assignments_one_active_per_site), the UI
  // just avoids offering an action that would fail.
  if (foreman) {
    return (
      <div className="mt-3 flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
        <HardHat className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm text-foreground truncate">{foreman.full_name ?? foreman.email_address ?? 'Foreman assigned'}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {invites?.map((invite) => (
        <div key={invite.id} className="flex items-center justify-between gap-2 bg-secondary rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground truncate">{invite.email}</span>
          <button onClick={() => copyLink(invite.token)} className="text-muted-foreground hover:text-primary shrink-0">
            {copied === invite.token ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex items-start gap-2" noValidate>
          <div className="flex-1">
            <Input placeholder="foreman@example.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <Button type="submit" size="sm" variant="construction" disabled={isSubmitting || createInvite.isPending}>
            Send
          </Button>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <LinkIcon className="w-4 h-4 mr-1" /> Invite foreman
        </Button>
      )}
    </div>
  );
}

function PermitApprovalRow({ siteId }: { siteId: string }) {
  const { data: permits } = useSitePermits(siteId);
  const decidePermit = useDecidePermit();
  const pending = permits?.filter((p) => p.status === 'pending') ?? [];

  if (!pending.length) return null;

  const handleDecide = async (permitId: string, approve: boolean, permitType: string) => {
    try {
      await decidePermit.mutateAsync({ permitId, approve });
      toast.success(approve ? 'Permit approved' : 'Permit rejected', {
        description: PERMIT_TYPE_LABELS[permitType] ?? permitType,
      });
    } catch (err) {
      toast.error('Could not update permit', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending permits</p>
      {pending.map((permit) => (
        <div key={permit.id} className="bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <p className="text-sm font-medium text-foreground">{PERMIT_TYPE_LABELS[permit.permit_type] ?? permit.permit_type}</p>
          </div>
          {permit.description && <p className="text-xs text-muted-foreground mb-2">{permit.description}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="construction"
              onClick={() => handleDecide(permit.id, true, permit.permit_type)}
              disabled={decidePermit.isPending}
            >
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDecide(permit.id, false, permit.permit_type)}
              disabled={decidePermit.isPending}
            >
              <XIcon className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContractorView() {
  const { data: sites, isLoading } = useAdminSites();
  const createSite = useCreateSite();
  const [overviewSite, setOverviewSite] = useState<{ id: string; site_name: string } | null>(null);
  const [paySite, setPaySite] = useState<{ id: string; site_name: string; monthly_rate: number } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateSiteValues>({ resolver: zodResolver(createSiteSchema) });

  const onSubmit = async (values: CreateSiteValues) => {
    try {
      await createSite.mutateAsync(values);
      toast.success('Site created', { description: `${values.site_name} is pending approval.` });
      reset();
    } catch (err) {
      toast.error('Could not create site', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="card-industrial p-4 space-y-3" noValidate>
        <h2 className="font-display text-xl text-foreground flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" /> New Site
        </h2>
        <div className="space-y-2">
          <Label htmlFor="site_name">Site Name</Label>
          <Input id="site_name" placeholder="Westlands Tower A" {...register('site_name')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="Nairobi" {...register('location')} />
        </div>
        <Button type="submit" variant="construction" className="w-full" disabled={isSubmitting}>
          CREATE SITE
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Your Sites</h2>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !sites?.length ? (
          <p className="text-sm text-muted-foreground">No sites yet — create one above.</p>
        ) : (
          sites.map((site) => (
            <div key={site.id} className="card-industrial p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{site.site_name}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {site.status}
                </span>
              </div>
              {site.location && <p className="text-sm text-muted-foreground">{site.location}</p>}
              {site.subscription_end && (
                <p className="text-xs text-muted-foreground mt-1">
                  Subscription {new Date(site.subscription_end) < new Date() ? 'expired' : 'active until'}{' '}
                  {new Date(site.subscription_end).toLocaleDateString('en-KE')}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setOverviewSite({ id: site.id, site_name: site.site_name })}>
                  <LayoutDashboard className="w-4 h-4 mr-1" /> Overview
                </Button>
                <Button
                  size="sm"
                  variant="construction"
                  onClick={() => setPaySite({ id: site.id, site_name: site.site_name, monthly_rate: site.monthly_rate })}
                >
                  <CreditCard className="w-4 h-4 mr-1" /> Pay / Renew
                </Button>
              </div>
              <InviteRow siteId={site.id} siteName={site.site_name} />
              <PermitApprovalRow siteId={site.id} />
            </div>
          ))
        )}
      </div>

      {overviewSite && (
        <ProjectOverviewView siteId={overviewSite.id} siteName={overviewSite.site_name} onClose={() => setOverviewSite(null)} />
      )}

      {paySite && (
        <PaySubscriptionDialog
          siteId={paySite.id}
          siteName={paySite.site_name}
          monthlyRate={paySite.monthly_rate}
          open={!!paySite}
          onClose={() => setPaySite(null)}
        />
      )}
    </div>
  );
}

function SuperAdminView() {
  const { data: pendingSites, isLoading } = usePendingSites();
  const approveSite = useApproveSite();
  const rejectSite = useRejectSite();

  const handleApprove = async (siteId: string, siteName: string) => {
    try {
      await approveSite.mutateAsync(siteId);
      toast.success('Site approved', { description: `${siteName} is now active.` });
    } catch (err) {
      toast.error('Could not approve site', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleReject = async (siteId: string, siteName: string) => {
    try {
      await rejectSite.mutateAsync(siteId);
      toast.success('Site rejected', { description: `${siteName} was cancelled.` });
    } catch (err) {
      toast.error('Could not reject site', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="space-y-4 w-full max-w-lg">
      <h2 className="font-display text-xl text-foreground flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" /> Pending Site Approvals
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : !pendingSites?.length ? (
        <p className="text-sm text-muted-foreground">No sites awaiting approval.</p>
      ) : (
        pendingSites.map((site) => (
          <div key={site.id} className="card-industrial p-4">
            <p className="font-medium text-foreground">{site.site_name}</p>
            {site.location && <p className="text-sm text-muted-foreground">{site.location}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Owner: {site.owner_name ?? 'Unknown'} ({site.owner_email ?? 'no email'})
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="construction"
                onClick={() => handleApprove(site.id, site.site_name)}
                disabled={approveSite.isPending || rejectSite.isPending}
              >
                <Check className="w-4 h-4 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(site.id, site.site_name)}
                disabled={approveSite.isPending || rejectSite.isPending}
              >
                <XIcon className="w-4 h-4 mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { user, isLoading, isSuperAdmin, isForeman, isAdmin, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="caution-stripe w-full" />
      <header className="container flex items-center justify-between h-16 px-4">
        <h1 className="font-display text-xl text-primary">MUTISO.AI</h1>
        <div className="flex items-center gap-3">
          <RoleBadge />
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6 flex flex-col items-center">
        {isSuperAdmin ? (
          <SuperAdminView />
        ) : isForeman ? (
          <ForemanDashboard />
        ) : isAdmin ? (
          <ContractorView />
        ) : (
          // No recognized role yet - e.g. the moment right after signup,
          // before a role has been assigned. Previously this fell through
          // to ContractorView by default, which is how a freshly-invited
          // foreman could briefly (or, on a lost race, permanently) see the
          // contractor screen instead of their own dashboard.
          <div className="text-center max-w-sm space-y-3 mt-12">
            <Skeleton className="h-6 w-48 mx-auto" />
            <p className="text-sm text-muted-foreground">Setting up your account...</p>
          </div>
        )}
      </main>
    </div>
  );
}
