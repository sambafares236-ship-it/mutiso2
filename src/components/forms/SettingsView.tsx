import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Settings as SettingsIcon, X, Loader2, MessageCircle, Mail, Smartphone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { normalizeKenyanPhone, formatKenyanPhone } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  full_name: z.string().min(1, 'Your name is required'),
  email_address: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone_number: z
    .string()
    .min(1, 'WhatsApp number is required')
    .refine((v) => normalizeKenyanPhone(v) !== null, 'Enter a valid Kenyan number, e.g. 0712 345 678'),
  mpesa_phone_number: z
    .string()
    .optional()
    .refine(
      (v) => !v || !v.trim() || normalizeKenyanPhone(v) !== null,
      'Enter a valid Kenyan number, e.g. 0712 345 678',
    ),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface SettingsViewProps {
  onClose: () => void;
  /** Contractors pay subscriptions; foremen don't, so they don't see this field. */
  showPaymentNumber?: boolean;
}

export function SettingsView({ onClose, showPaymentNumber = false }: SettingsViewProps) {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    // `values` (rather than defaultValues) so the form populates once the
    // profile query resolves, without a manual reset() in an effect.
    values: {
      full_name: profile?.full_name ?? '',
      email_address: profile?.email_address ?? user?.email ?? '',
      phone_number: profile?.phone_number ?? '',
      mpesa_phone_number: profile?.mpesa_phone_number ?? '',
    },
  });

  const watchedPhone = watch('phone_number');
  const watchedMpesa = watch('mpesa_phone_number');
  const watchedEmail = watch('email_address');

  const normalizedPhone = normalizeKenyanPhone(watchedPhone || '');
  const normalizedMpesa = normalizeKenyanPhone(watchedMpesa || '');
  const emailWillChangeSignIn =
    !!watchedEmail &&
    !!user?.email &&
    watchedEmail.trim().toLowerCase() !== user.email.toLowerCase();

  const onSubmit = async (values: FormValues) => {
    if (!user?.id) return;
    try {
      const result = await updateProfile.mutateAsync({
        userId: user.id,
        full_name: values.full_name,
        email_address: values.email_address,
        currentAuthEmail: user.email,
        phone_number: values.phone_number,
        mpesa_phone_number: values.mpesa_phone_number ?? '',
      });

      if (result.emailConfirmationPending) {
        toast.success('Settings saved', {
          description: `Confirm the link sent to ${result.newEmail} to finish changing your sign-in email.`,
        });
      } else {
        toast.success('Settings saved', {
          description: 'Your contact details are now used by alerts and the WhatsApp bot.',
        });
      }
      onClose();
    } catch (err) {
      toast.error('Could not save settings', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">SETTINGS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="full_name">Your name *</Label>
              <Input id="full_name" placeholder="John Kamau" {...register('full_name')} />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_address" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email *
              </Label>
              <Input
                id="email_address"
                type="email"
                placeholder="you@example.com"
                {...register('email_address')}
              />
              <p className="text-xs text-muted-foreground">
                Used for your sign-in and for email alerts and digests.
              </p>
              {emailWillChangeSignIn && (
                <p className="text-xs text-primary">
                  Changing this also changes the email you sign in with. We&apos;ll send a
                  confirmation link to the new address if one is required.
                </p>
              )}
              {errors.email_address && (
                <p className="text-xs text-destructive">{errors.email_address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
                WhatsApp number *
              </Label>
              <Input
                id="phone_number"
                type="tel"
                inputMode="tel"
                placeholder="0712 345 678"
                {...register('phone_number')}
              />
              <p className="text-xs text-muted-foreground">
                The WhatsApp assistant recognises you by this number, and site alerts are sent
                here. Changing it takes effect immediately.
              </p>
              {normalizedPhone && (
                <p className="text-xs text-success">Saved as {formatKenyanPhone(normalizedPhone)}</p>
              )}
              {errors.phone_number && (
                <p className="text-xs text-destructive">{errors.phone_number.message}</p>
              )}
            </div>

            {showPaymentNumber && (
              <div className="space-y-2">
                <Label htmlFor="mpesa_phone_number" className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  M-Pesa number
                </Label>
                <Input
                  id="mpesa_phone_number"
                  type="tel"
                  inputMode="tel"
                  placeholder="Same as WhatsApp number"
                  {...register('mpesa_phone_number')}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Used for subscription payments. Leave blank to use your WhatsApp number.
                </p>
                {normalizedMpesa && (
                  <p className="text-xs text-success">
                    Saved as {formatKenyanPhone(normalizedMpesa)}
                  </p>
                )}
                {errors.mpesa_phone_number && (
                  <p className="text-xs text-destructive">{errors.mpesa_phone_number.message}</p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="construction" className="flex-1" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
