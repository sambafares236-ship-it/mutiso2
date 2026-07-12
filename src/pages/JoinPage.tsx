import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, Building, CheckCircle, HardHat, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInviteByToken, useConsumeInvite } from '@/hooks/useInvite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const consumeInvite = useConsumeInvite();
  const { refreshRoles } = useAuth();
  const { data: invite, isLoading: inviteLoading } = useInviteByToken(token);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (invite?.email) setValue('email', invite.email);
  }, [invite, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!invite || !token) return;

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.full_name, is_invite: true },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Signup failed - please try again.');

      await consumeInvite.mutateAsync({ token });

      // Refetch roles before navigating - consume_invite() grants 'foreman'
      // well after the initial post-signup roles fetch already ran (and
      // very likely found none yet), so without this refresh Index.tsx
      // would render off the stale, still-empty role list.
      await refreshRoles();

      toast.success('Welcome to Mutiso.AI!', {
        description: `You have been assigned to ${invite.site?.site_name ?? 'your site'}.`,
      });
      navigate('/', { replace: true });
    } catch (err) {
      toast.error('Could not complete signup', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  if (!token || !invite) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="caution-stripe w-full fixed top-0 left-0" />
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl text-foreground">INVALID INVITE</h1>
          <p className="text-muted-foreground">
            This invite link is invalid, expired, or has already been used. Contact your contractor for a new link.
          </p>
          <Button variant="outline" onClick={() => navigate('/auth')}>
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="caution-stripe w-full fixed top-0 left-0" />

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl text-primary">MUTISO.AI</h1>
          <p className="text-muted-foreground mt-1">You've been invited</p>
        </div>

        <div className="card-industrial p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">You are joining</p>
              <p className="font-display text-lg text-primary">{invite.site?.site_name ?? 'Construction Site'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-xs text-success font-medium">
              Valid invite - expires {new Date(invite.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" placeholder="John Kamau" {...register('full_name')} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" readOnly {...register('email')} />
            <p className="text-xs text-muted-foreground">This invite was issued to this email address.</p>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Creating account...
              </>
            ) : (
              'JOIN AS FOREMAN'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
