import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentCertificate } from './usePaymentCertificates';

export interface FinanceSummary {
  contractValue: number | null;
  currency: string;
  budgetTotal: number;
  laborActualTotal: number;
  nonLaborActualTotal: number;
  pettyCashTotal: number;
  actualTotal: number;
  variance: number | null;
  latestCertificate: PaymentCertificate | null;
  totalNetCertified: number;
}

// Rolls up contract value, budget, and actuals into one summary - "actuals"
// combines payroll_line.gross_amount (labor, the existing source of truth)
// with the new actual_cost table (everything else), rather than treating
// labor as missing just because it isn't in actual_cost. See the
// contract_and_financials migration comment for why labor isn't duplicated
// into actual_cost.
export function useFinanceSummary(siteId: string | undefined) {
  return useQuery({
    queryKey: ['financeSummary', siteId],
    queryFn: async (): Promise<FinanceSummary> => {
      const empty: FinanceSummary = {
        contractValue: null,
        currency: 'KES',
        budgetTotal: 0,
        laborActualTotal: 0,
        nonLaborActualTotal: 0,
        pettyCashTotal: 0,
        actualTotal: 0,
        variance: null,
        latestCertificate: null,
        totalNetCertified: 0,
      };
      if (!siteId) return empty;

      const [contractRes, budgetRes, actualCostRes, laborRes, certRes, pettyCashRes] = await Promise.all([
        supabase.from('site_contract').select('contract_value, currency').eq('site_id', siteId).maybeSingle(),
        supabase.from('budget_line').select('budgeted_amount').eq('site_id', siteId),
        supabase.from('actual_cost').select('amount').eq('site_id', siteId),
        supabase.from('payroll_line').select('gross_amount, payroll_run!inner(site_id)').eq('payroll_run.site_id', siteId),
        supabase.from('payment_certificate').select('*').eq('site_id', siteId).order('certificate_number', { ascending: false }),
        supabase.from('petty_cash_log').select('amount').eq('site_id', siteId),
      ]);

      if (contractRes.error) throw contractRes.error;
      if (budgetRes.error) throw budgetRes.error;
      if (actualCostRes.error) throw actualCostRes.error;
      if (laborRes.error) throw laborRes.error;
      if (certRes.error) throw certRes.error;
      if (pettyCashRes.error) throw pettyCashRes.error;

      const budgetTotal = (budgetRes.data || []).reduce((sum, b) => sum + Number(b.budgeted_amount), 0);
      const nonLaborActualTotal = (actualCostRes.data || []).reduce((sum, c) => sum + Number(c.amount), 0);
      const laborActualTotal = (laborRes.data || []).reduce((sum, l) => sum + Number(l.gross_amount), 0);
      const pettyCashTotal = (pettyCashRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const actualTotal = laborActualTotal + nonLaborActualTotal + pettyCashTotal;
      const certificates = certRes.data || [];
      const totalNetCertified = certificates.reduce((sum, c) => sum + Number(c.net_amount_due), 0);

      return {
        contractValue: contractRes.data?.contract_value ?? null,
        currency: contractRes.data?.currency ?? 'KES',
        budgetTotal,
        laborActualTotal,
        nonLaborActualTotal,
        pettyCashTotal,
        actualTotal,
        variance: budgetTotal > 0 ? budgetTotal - actualTotal : null,
        latestCertificate: certificates[0] ?? null,
        totalNetCertified,
      };
    },
    enabled: !!siteId,
  });
}
