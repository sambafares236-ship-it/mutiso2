import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeKenyanPhone } from '@/lib/phone';
import type { Database } from '@/integrations/supabase/types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export interface UpdateProfileInput {
  userId: string;
  full_name: string;
  /**
   * Notification email. When this differs from the current auth email we also
   * ask Supabase Auth to move the sign-in address (see below).
   */
  email_address: string;
  /** Current auth (sign-in) email, used to detect whether it actually changed. */
  currentAuthEmail: string | null | undefined;
  /** WhatsApp/notification number, any commonly-written Kenyan format. */
  phone_number: string;
  /** Optional M-Pesa number; falls back to phone_number server-side when blank. */
  mpesa_phone_number: string;
}

export interface UpdateProfileResult {
  /**
   * True when Supabase Auth did not apply the new sign-in email immediately and
   * sent a confirmation link instead. The project has double_confirm_changes
   * enabled, so this depends on server-side auth config rather than anything
   * the client controls - it is read back from the response rather than assumed.
   */
  emailConfirmationPending: boolean;
  newEmail: string | null;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<UpdateProfileResult> => {
      const phone = normalizeKenyanPhone(input.phone_number);
      if (!phone) throw new Error('Enter a valid Kenyan phone number, e.g. 0712 345 678');

      // Blank M-Pesa number is legitimate - it means "use my WhatsApp number",
      // which the RPCs handle via coalesce. Only validate when one was typed.
      const rawMpesa = input.mpesa_phone_number.trim();
      let mpesa: string | null = null;
      if (rawMpesa) {
        mpesa = normalizeKenyanPhone(rawMpesa);
        if (!mpesa) throw new Error('Enter a valid M-Pesa number, e.g. 0712 345 678');
      }

      const email = input.email_address.trim();

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: input.full_name.trim(),
          email_address: email,
          phone_number: phone,
          mpesa_phone_number: mpesa,
        })
        .eq('id', input.userId)
        .select()
        .single();
      // An RLS-filtered UPDATE reports no error but affects nothing, so .single()
      // is what actually proves the row was written.
      if (error) {
        // A phone number may only belong to one account: the WhatsApp assistant
        // identifies a contractor purely by their number, so a shared one is
        // genuinely ambiguous (see 20260731091700_unique_profile_phone_number).
        // Postgres reports this as a raw unique-violation on an index name that
        // means nothing to a contractor, so translate it here.
        if (error.code === '23505' && error.message?.includes('profiles_normalized_phone_unique')) {
          throw new Error(
            'That phone number is already registered to another Mutiso.AI account. Use a different number, or sign in to the account that already uses it.',
          );
        }
        throw error;
      }

      // The sign-in address is separate from the notification address above.
      // Only touch Auth when the email genuinely changed, so a user editing
      // only their phone never triggers a confirmation email.
      let emailConfirmationPending = false;
      const authEmailChanged =
        !!email && email.toLowerCase() !== (input.currentAuthEmail || '').toLowerCase();

      if (authEmailChanged) {
        const { data: authData, error: authError } = await supabase.auth.updateUser({ email });
        if (authError) throw authError;
        // When a confirmation is required Supabase keeps `email` as the old
        // address and parks the new one in `new_email`.
        const applied = authData.user?.email?.toLowerCase() === email.toLowerCase();
        emailConfirmationPending = !applied;
      }

      return { emailConfirmationPending, newEmail: authEmailChanged ? email : null };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
}
