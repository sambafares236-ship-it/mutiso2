import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialPayment {
  id: string;
  amount: number;
  date_incurred: string;
  invoice_reference: string | null;
}

export interface DeliveryWithPayments {
  id: string;
  date: string;
  material_name: string;
  supplier: string | null;
  quantity: number;
  unit: string | null;
  receiptUrl: string | null;
  payments: MaterialPayment[];
  totalPaid: number;
}

// Contractor-facing "match a delivery to what was paid for it" view -
// joins materials_delivered (foreman field capture) with actual_cost rows
// that reference it via material_delivery_id (contractor-entered, owner-
// only per RLS). Client-side join rather than a DB view, same approach
// useSiteReport already takes for combining unrelated tables.
export function useMaterialPayments(siteId: string | undefined) {
  return useQuery({
    queryKey: ['materialPayments', siteId],
    queryFn: async (): Promise<DeliveryWithPayments[]> => {
      if (!siteId) return [];

      const [deliveries, costs] = await Promise.all([
        supabase
          .from('materials_delivered')
          .select('id, date, material_name, supplier, quantity, unit, receipt_photo_url')
          .eq('site_id', siteId)
          .order('date', { ascending: false })
          .limit(200),
        supabase
          .from('actual_cost')
          .select('id, amount, date_incurred, invoice_reference, material_delivery_id')
          .eq('site_id', siteId)
          .not('material_delivery_id', 'is', null),
      ]);
      if (deliveries.error) throw deliveries.error;
      if (costs.error) throw costs.error;

      const receiptUrls = await Promise.all(
        (deliveries.data ?? []).map(async (d) => {
          if (!d.receipt_photo_url) return null;
          const { data: signed } = await supabase.storage.from('site-photos').createSignedUrl(d.receipt_photo_url, 60 * 60);
          return signed?.signedUrl ?? null;
        }),
      );

      return (deliveries.data ?? []).map((d, i) => {
        const payments = (costs.data ?? [])
          .filter((c) => c.material_delivery_id === d.id)
          .map((c) => ({ id: c.id, amount: c.amount, date_incurred: c.date_incurred, invoice_reference: c.invoice_reference }));
        return {
          id: d.id,
          date: d.date,
          material_name: d.material_name,
          supplier: d.supplier,
          quantity: d.quantity,
          unit: d.unit,
          receiptUrl: receiptUrls[i],
          payments,
          totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
        };
      });
    },
    enabled: !!siteId,
  });
}

// Owner-only (actual_cost's existing RLS already enforces this) - a
// contractor recording what was actually paid for a delivery, not a
// foreman field action, so this isn't offline-queued. Same reasoning as
// useCreateActualCost/useCreateBudgetLine.
export function useRecordMaterialPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      site_id: string;
      created_by: string;
      material_delivery_id: string;
      amount: number;
      date_incurred?: string;
      invoice_reference?: string;
    }) => {
      const { error } = await supabase.from('actual_cost').insert({ ...payment, cost_type: 'material' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['materialPayments', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['actualCosts', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}
