import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/PasswordInput';
import { HardHat, Loader2 } from 'lucide-react';
import { normalizeKenyanPhone } from '@/lib/phone';

type Mode = 'signup' | 'signin' | 'forgot';

const schema = z.object({
  full_name: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().optional(),
  phone_number: z.string().optional(),
  agreed_to_terms: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email'),
});
type ForgotValues = z.infer<typeof forgotSchema>;

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors, isSubmitting: isForgotSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/app', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (mode === 'signup') {
        if (!values.full_name) {
          setError('full_name', { message: 'Full name is required' });
          return;
        }
        const normalizedPhone = normalizeKenyanPhone(values.phone_number ?? '');
        if (!normalizedPhone) {
          setError('phone_number', { message: 'Enter a valid Kenyan phone number (e.g. 07XXXXXXXX)' });
          return;
        }
        if (values.password !== values.confirm_password) {
          setError('confirm_password', { message: 'Passwords do not match' });
          return;
        }
        if (!values.agreed_to_terms) {
          setError('agreed_to_terms', { message: 'You must agree to the Terms and Privacy Policy' });
          return;
        }

        // A phone number can only belong to one account (the WhatsApp assistant
        // identifies a contractor by it), and signing up with a different email
        // is otherwise enough to create a second account for the same person.
        // Catch that here so they're sent to sign-in rather than ending up with
        // a duplicate identity they can't use the assistant from.
        const { data: phoneAvailable, error: availabilityError } = await supabase.rpc(
          'is_phone_number_available',
          { p_phone: normalizedPhone },
        );
        // A failed check shouldn't block signup - the unique index is the real
        // guarantee, and handle_new_user() degrades safely either way.
        if (!availabilityError && phoneAvailable === false) {
          setError('phone_number', {
            message: 'This number already has an account. Sign in instead, or use a different number.',
          });
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: values.full_name, phone_number: normalizedPhone } },
        });
        if (error) throw error;

        // Backstop for the race between the check above and the insert: if the
        // number got claimed in between, handle_new_user() drops it rather than
        // failing the whole signup, which would otherwise leave the account
        // silently unable to use the assistant.
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .maybeSingle();

        if (newProfile && !newProfile.phone_number) {
          toast.warning('Account created, but your phone number was not saved', {
            description:
              'That number was just registered to another account. Add a different one in Settings to use the WhatsApp assistant.',
          });
        } else {
          toast.success('Account created', { description: 'Welcome to Mutiso.AI.' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        toast.success('Welcome back');
      }
      navigate('/app', { replace: true });
    } catch (err) {
      toast.error(mode === 'signup' ? 'Sign up failed' : 'Sign in failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  };

  const onForgotSubmit = async (values: ForgotValues) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Check your email', {
        description: `If an account exists for ${values.email}, a password reset link is on its way.`,
      });
      setMode('signin');
    } catch (err) {
      toast.error('Could not send reset link', { description: err instanceof Error ? err.message : undefined });
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
          <p className="text-muted-foreground mt-1">Construction site management</p>
        </div>

        {mode !== 'forgot' && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-4" noValidate>
            <div>
              <p className="font-medium text-foreground">Reset your password</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your account email and we'll send you a link to reset your password.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot_email">Email</Label>
              <Input id="forgot_email" type="email" placeholder="you@example.com" {...registerForgot('email')} />
              {forgotErrors.email && <p className="text-xs text-destructive">{forgotErrors.email.message}</p>}
            </div>
            <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isForgotSubmitting}>
              {isForgotSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                </>
              ) : (
                'SEND RESET LINK'
              )}
            </Button>
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline"
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode !== 'forgot' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" type="text" placeholder="John Kamau" {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number (WhatsApp)</Label>
              <Input id="phone_number" type="tel" placeholder="07XX XXX XXX" {...register('phone_number')} />
              <p className="text-xs text-muted-foreground">
                Used for M-Pesa payments and the WhatsApp bot/alerts - must be able to receive WhatsApp messages.
              </p>
              {errors.phone_number && <p className="text-xs text-destructive">{errors.phone_number.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-primary hover:text-primary/80 underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordInput id="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <PasswordInput id="confirm_password" autoComplete="new-password" {...register('confirm_password')} />
              {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <Controller
                  name="agreed_to_terms"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="agreed_to_terms"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  )}
                />
                <Label htmlFor="agreed_to_terms" className="text-xs font-normal text-muted-foreground leading-snug">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">
                    Privacy Policy
                  </a>
                  .
                </Label>
              </div>
              {errors.agreed_to_terms && <p className="text-xs text-destructive">{errors.agreed_to_terms.message}</p>}
            </div>
          )}

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              </>
            ) : mode === 'signup' ? (
              'SIGN UP'
            ) : (
              'SIGN IN'
            )}
          </Button>
        </form>
        )}
      </div>
    </div>
  );
}
