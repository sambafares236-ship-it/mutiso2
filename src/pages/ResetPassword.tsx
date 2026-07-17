import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PasswordInput } from '@/components/PasswordInput';
import { HardHat, Loader2 } from 'lucide-react';

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().min(1, 'Confirm your new password'),
});
type FormValues = z.infer<typeof schema>;

// Reached via the link in the "reset your password" email
// (resetPasswordForEmail's redirectTo). The Supabase client auto-detects the
// recovery token in the URL and establishes a session before this page ever
// renders - useAuth()'s session is the signal that the link was valid, not
// a bespoke onAuthStateChange listener here (AuthProvider already owns
// that).
export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, isLoading } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    if (values.password !== values.confirm_password) {
      setError('confirm_password', { message: 'Passwords do not match' });
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      toast.success('Password updated', { description: 'Signed in with your new password.' });
      navigate('/app', { replace: true });
    } catch (err) {
      toast.error('Could not update password', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="caution-stripe w-full fixed top-0 left-0" />

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl text-primary">MUTISO.AI</h1>
          <p className="text-muted-foreground mt-1">Set a new password</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ) : !session ? (
          <div className="card-industrial p-4 text-center space-y-3">
            <p className="text-foreground font-medium">This reset link is invalid or has expired</p>
            <p className="text-sm text-muted-foreground">
              Request a new one from the sign-in page.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <PasswordInput id="confirm_password" autoComplete="new-password" {...register('confirm_password')} />
              {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
            </div>
            <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Updating...
                </>
              ) : (
                'UPDATE PASSWORD'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
