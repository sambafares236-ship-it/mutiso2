import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HardHat, Loader2 } from 'lucide-react';

type Mode = 'signup' | 'signin';

const schema = z.object({
  full_name: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (mode === 'signup') {
        if (!values.full_name) {
          setError('full_name', { message: 'Full name is required' });
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: values.full_name } },
        });
        if (error) throw error;
        toast.success('Account created', { description: 'Welcome to Mutiso.AI.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        toast.success('Welcome back');
      }
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(mode === 'signup' ? 'Sign up failed' : 'Sign in failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" type="text" placeholder="John Kamau" {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
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
                <Loader2 className="w-5 h-5 animate-spin" /> {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              </>
            ) : mode === 'signup' ? (
              'SIGN UP'
            ) : (
              'SIGN IN'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
