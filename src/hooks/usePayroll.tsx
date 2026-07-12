import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type PayrollRun = Database['public']['Tables']['payroll_run']['Row'];
export type PayrollLine = Database['public']['Tables']['payroll_line']['Row'] & {
  worker: { full_name: string } | null;
};

function today() {
  return new Date().toISOString().split('T')[0];
}

export function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

export function sundayOfThisWeek() {
  const monday = new Date(mondayOfThisWeek());
  monday.setDate(monday.getDate() + 6);
  return monday.toISOString().split('T')[0];
}

export function useSitePayrollRuns(siteId: string | undefined) {
  return useQuery({
    queryKey: ['payrollRuns', siteId],
    queryFn: async (): Promise<PayrollRun[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('payroll_run')
        .select('*')
        .eq('site_id', siteId)
        .order('week_start', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function usePayrollLines(payrollRunId: string | undefined) {
  return useQuery({
    queryKey: ['payrollLines', payrollRunId],
    queryFn: async (): Promise<PayrollLine[]> => {
      if (!payrollRunId) return [];
      const { data, error } = await supabase
        .from('payroll_line')
        .select('*, worker:workers_master(full_name)')
        .eq('payroll_run_id', payrollRunId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!payrollRunId,
  });
}

export interface PayrollSummary {
  todayTotal: number;
  weekTotal: number;
  weekPaid: number;
  weekPending: number;
  /** true once a payroll_run exists for the current week - weekTotal is
   * then the real generated figure rather than a live attendance-based
   * estimate, and weekPaid/weekPending reflect actual Mark Paid state. */
  weekConfirmed: boolean;
  /** Lifetime sum of every payroll_line ever marked paid, across every
   * run - the running "total labour payments" ledger. Grows only when a
   * line is actually marked paid, independent of which week it belongs
   * to (unlike weekPaid, which is scoped to the current week's run). */
  totalPaidAllTime: number;
}

// Automatic totals for the contractor/foreman - "automatic" because
// neither number requires Generate Payroll Run to have been clicked.
// Today's total has no run-level equivalent at all (payroll_run is
// week-scoped, there's no daily run), so it's always a live estimate from
// today's attendance x daily_rate. The week total upgrades from a live
// estimate to the authoritative generated figure (with a real paid/
// pending split) the moment a run exists for the current week - see the
// CLAUDE.md "financial authority ≠ field capture" note: reading this is
// fine for a foreman (workers_master.daily_rate and payroll_line are
// already foreman-readable per RLS), only generating/marking paid is
// owner-only.
export function usePayrollSummary(siteId: string | undefined) {
  return useQuery({
    queryKey: ['payrollSummary', siteId],
    queryFn: async (): Promise<PayrollSummary> => {
      const empty: PayrollSummary = { todayTotal: 0, weekTotal: 0, weekPaid: 0, weekPending: 0, weekConfirmed: false, totalPaidAllTime: 0 };
      if (!siteId) return empty;

      const weekStart = mondayOfThisWeek();
      const weekEnd = sundayOfThisWeek();

      const [todayRes, runRes, paidRes] = await Promise.all([
        supabase
          .from('attendance_log')
          .select('worker:workers_master(daily_rate)')
          .eq('site_id', siteId)
          .eq('date', today()),
        supabase.from('payroll_run').select('id').eq('site_id', siteId).eq('week_start', weekStart).eq('week_end', weekEnd).maybeSingle(),
        supabase
          .from('payroll_line')
          .select('gross_amount, payroll_run!inner(site_id)')
          .eq('payroll_run.site_id', siteId)
          .eq('paid', true),
      ]);
      if (todayRes.error) throw todayRes.error;
      if (runRes.error) throw runRes.error;
      if (paidRes.error) throw paidRes.error;

      const todayTotal = (todayRes.data ?? []).reduce((sum, a) => sum + Number(a.worker?.daily_rate ?? 0), 0);
      const totalPaidAllTime = (paidRes.data ?? []).reduce((sum, l) => sum + Number(l.gross_amount), 0);

      if (runRes.data) {
        const linesRes = await supabase.from('payroll_line').select('gross_amount, paid').eq('payroll_run_id', runRes.data.id);
        if (linesRes.error) throw linesRes.error;
        const weekTotal = (linesRes.data ?? []).reduce((sum, l) => sum + Number(l.gross_amount), 0);
        const weekPaid = (linesRes.data ?? []).filter((l) => l.paid).reduce((sum, l) => sum + Number(l.gross_amount), 0);
        return { todayTotal, weekTotal, weekPaid, weekPending: weekTotal - weekPaid, weekConfirmed: true, totalPaidAllTime };
      }

      const weekRes = await supabase
        .from('attendance_log')
        .select('worker:workers_master(daily_rate)')
        .eq('site_id', siteId)
        .gte('date', weekStart)
        .lte('date', weekEnd);
      if (weekRes.error) throw weekRes.error;
      const weekTotal = (weekRes.data ?? []).reduce((sum, a) => sum + Number(a.worker?.daily_rate ?? 0), 0);

      return { todayTotal, weekTotal, weekPaid: 0, weekPending: weekTotal, weekConfirmed: false, totalPaidAllTime };
    },
    enabled: !!siteId,
  });
}

// Owner-only, enforced both by RLS (payroll_run/payroll_line UPDATE
// policies) and inside the RPC itself. Computes days_present and
// gross/net amounts from real attendance_log data in one transaction.
export function useGeneratePayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ siteId, weekStart, weekEnd }: { siteId: string; weekStart: string; weekEnd: string }) => {
      const { data, error } = await supabase.rpc('generate_payroll_run', {
        p_site_id: siteId,
        p_week_start: weekStart,
        p_week_end: weekEnd,
      });
      if (error) throw error;
      return data; // new payroll_run id
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ['payrollSummary', variables.siteId] });
    },
  });
}

export function useUpdatePayrollLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lineId,
      advances,
      deductions,
      grossAmount,
    }: {
      lineId: string;
      advances: number;
      deductions: number;
      grossAmount: number;
    }) => {
      const { error } = await supabase
        .from('payroll_line')
        .update({ advances, deductions, net_amount: grossAmount - advances - deductions })
        .eq('id', lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollLines'] });
    },
  });
}

// Foreman-only (not owner) - see the mark_payroll_line_paid() migration
// comment. Goes through the RPC rather than a raw table update since the
// blanket payroll_line policy is still owner-only (it also governs
// advances/deductions edits) - the RPC does its own explicit
// is_assigned_foreman() check and only ever touches paid/paid_by/paid_at.
export function useMarkPayrollLinePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lineId }: { lineId: string; siteId: string }) => {
      const { error } = await supabase.rpc('mark_payroll_line_paid', { p_line_id: lineId });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payrollLines'] });
      queryClient.invalidateQueries({ queryKey: ['payrollSummary', variables.siteId] });
    },
  });
}
