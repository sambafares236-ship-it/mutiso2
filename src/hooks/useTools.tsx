import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';
import { isExpiringSoon } from './useCertifications';

export type Tool = Database['public']['Tables']['tool_inventory']['Row'];
export type ToolCheckoutLog = Database['public']['Tables']['tool_checkout_log']['Row'];
export type MaintenanceLog = Database['public']['Tables']['equipment_maintenance_log']['Row'];
export type UsageSession = Database['public']['Tables']['tool_usage_session']['Row'];
export type UsageEvent = Database['public']['Tables']['tool_usage_event']['Row'];
// Foreman-facing plant reads go through tool_inventory_foreman (a view,
// not a table - regenerate types.ts to pick this up), which is
// tool_inventory minus cost_per_hour. Same row shape otherwise, so a
// foreman-side Tool is just Tool with cost_per_hour guaranteed absent.
export type ForemanTool = Omit<Tool, 'cost_per_hour'>;

export function useSiteTools(siteId: string | undefined) {
  const { isContractor } = useAuth();

  return useQuery({
    queryKey: ['tools', siteId, isContractor],
    queryFn: async (): Promise<Tool[] | ForemanTool[]> => {
      if (!siteId) return [];
      // Contractor reads the base table (sees cost_per_hour); foreman
      // reads the view (column physically absent from the response, not
      // just hidden client-side - see 20260801090000's comment on why).
      if (isContractor) {
        const { data, error } = await supabase.from('tool_inventory').select('*').eq('site_id', siteId).order('tool_name');
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase.from('tool_inventory_foreman').select('*').eq('site_id', siteId).order('tool_name');
      if (error) throw error;
      // The generated view type marks every column nullable (a supabase
      // gen-types limitation for views, not a real runtime possibility) -
      // every one of these columns is NOT NULL on the underlying table,
      // so the cast is safe.
      return (data || []) as ForemanTool[];
    },
    enabled: !!siteId,
  });
}

// Contractor-only: create plant equipment with its rate and active flag.
// RLS backs this up (foreman INSERT on category='plant' is rejected), this
// hook just keeps the client from ever attempting it.
export function useAddEquipment() {
  return useMutation({
    mutationFn: async (equipment: {
      site_id: string;
      tool_name: string;
      tool_id_number?: string;
      meter_unit?: string;
      cost_per_hour?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('tool_inventory')
        .insert({ ...equipment, category: 'plant', is_active: equipment.is_active ?? true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// Contractor-only: edit rate / active flag / details on existing plant.
export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      site_id,
      ...updates
    }: {
      id: string;
      site_id: string;
      tool_name?: string;
      tool_id_number?: string;
      meter_unit?: string;
      cost_per_hour?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase.from('tool_inventory').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tools', variables.site_id] });
    },
  });
}

export function useAddTool() {
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (tool: { site_id: string; tool_name: string; tool_id_number?: string; category?: string; meter_unit?: string }) => {
      return submitOrQueue({
        kind: 'insert',
        table: 'tool_inventory',
        payload: { ...tool, category: tool.category ?? 'tool' },
        description: `Add tool: ${tool.tool_name}`,
      });
    },
  });
}

export function useToolCheckoutHistory(toolId: string | undefined) {
  return useQuery({
    queryKey: ['toolCheckoutHistory', toolId],
    queryFn: async (): Promise<ToolCheckoutLog[]> => {
      if (!toolId) return [];
      const { data, error } = await supabase
        .from('tool_checkout_log')
        .select('*')
        .eq('tool_id', toolId)
        .order('checked_out_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!toolId,
  });
}

// checkout_tool/return_tool are SECURITY DEFINER RPCs, same reasoning as
// log_material_delivery/usage - each is an atomic check-current-status,
// then flip-status-and-log-the-transition, and both go through the
// offline queue since a foreman on a low-connectivity site plausibly
// checks tools in/out in the field just like they mark attendance.
// Checkout recipient is a real worker_id, not a typed name - checkout_tool()
// itself enforces "who is in" (the worker must have an attendance_log row
// for today), so this hook can't accidentally bypass that by queuing an
// offline checkout for someone who never gets marked present.
export function useCheckoutTool() {
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ toolId, workerId, meterReading }: { toolId: string; workerId: string; meterReading?: number }) => {
      return submitOrQueue({
        kind: 'rpc',
        fn: 'checkout_tool',
        payload: { p_tool_id: toolId, p_worker_id: workerId, p_meter_reading: meterReading ?? null },
        description: `Check out tool`,
      });
    },
  });
}

export function useReturnTool() {
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async ({
      toolId,
      conditionOnReturn,
      meterReading,
    }: {
      toolId: string;
      conditionOnReturn?: string;
      meterReading?: number;
    }) => {
      return submitOrQueue({
        kind: 'rpc',
        fn: 'return_tool',
        payload: { p_tool_id: toolId, p_condition_on_return: conditionOnReturn ?? null, p_meter_reading: meterReading ?? null },
        description: `Return tool`,
      });
    },
  });
}

// The one open (non-'ended') session for a tool, if any, plus its events -
// this is what drives the Start/Pause/Resume/Stop card state and the live
// "active so far" readout.
export function useActiveUsageSession(toolId: string | undefined) {
  return useQuery({
    queryKey: ['activeUsageSession', toolId],
    queryFn: async (): Promise<{ session: UsageSession; events: UsageEvent[] } | null> => {
      if (!toolId) return null;
      const { data: session, error: sessionError } = await supabase
        .from('tool_usage_session')
        .select('*')
        .eq('tool_id', toolId)
        .neq('status', 'ended')
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return null;

      const { data: events, error: eventsError } = await supabase
        .from('tool_usage_event')
        .select('*')
        .eq('session_id', session.id)
        .order('event_at', { ascending: true });
      if (eventsError) throw eventsError;

      return { session, events: events || [] };
    },
    enabled: !!toolId,
    refetchInterval: 30_000, // keep the live timer roughly current without a client-side clock loop
  });
}

export function useToolUsageSessions(toolId: string | undefined) {
  return useQuery({
    queryKey: ['toolUsageSessions', toolId],
    queryFn: async (): Promise<UsageSession[]> => {
      if (!toolId) return [];
      const { data, error } = await supabase
        .from('tool_usage_session')
        .select('*')
        .eq('tool_id', toolId)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!toolId,
  });
}

function invalidateUsage(queryClient: ReturnType<typeof useQueryClient>, toolId: string) {
  queryClient.invalidateQueries({ queryKey: ['activeUsageSession', toolId] });
  queryClient.invalidateQueries({ queryKey: ['toolUsageSessions', toolId] });
  queryClient.invalidateQueries({ queryKey: ['tools'] }); // status column changed
  queryClient.invalidateQueries({ queryKey: ['equipmentEfficiency'] });
}

export function useStartUsageSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toolId,
      operatorName,
      meterReading,
    }: {
      toolId: string;
      operatorName?: string;
      meterReading?: number;
    }) => {
      const { data, error } = await supabase.rpc('start_usage_session', {
        p_tool_id: toolId,
        p_operator_name: operatorName ?? null,
        p_meter_reading: meterReading ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => invalidateUsage(queryClient, variables.toolId),
  });
}

export function usePauseUsageSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string; toolId: string }) => {
      const { error } = await supabase.rpc('pause_usage_session', { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidateUsage(queryClient, variables.toolId),
  });
}

export function useResumeUsageSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string; toolId: string }) => {
      const { error } = await supabase.rpc('resume_usage_session', { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidateUsage(queryClient, variables.toolId),
  });
}

export function useStopUsageSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, meterReading }: { sessionId: string; toolId: string; meterReading?: number }) => {
      const { error } = await supabase.rpc('stop_usage_session', {
        p_session_id: sessionId,
        p_meter_reading: meterReading ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidateUsage(queryClient, variables.toolId),
  });
}

// Sums start/resume -> pause/stop gaps into total active seconds. Computed
// on read from the raw event log, deliberately not stored anywhere (same
// "compute, don't store" convention useEquipmentEfficiency already uses) -
// a lunch pause simply never contributes an interval, rather than being
// subtracted after the fact.
export function activeSecondsFromEvents(events: UsageEvent[], now: number = Date.now()): number {
  let total = 0;
  let openStart: number | null = null;
  for (const e of events) {
    const t = new Date(e.event_at).getTime();
    if (e.event_type === 'start' || e.event_type === 'resume') {
      openStart = t;
    } else if ((e.event_type === 'pause' || e.event_type === 'stop') && openStart !== null) {
      total += (t - openStart) / 1000;
      openStart = null;
    }
  }
  if (openStart !== null) {
    total += (now - openStart) / 1000; // still running - count up to now
  }
  return total;
}

export function useToolMaintenanceLogs(toolId: string | undefined) {
  return useQuery({
    queryKey: ['maintenanceLogs', toolId],
    queryFn: async (): Promise<MaintenanceLog[]> => {
      if (!toolId) return [];
      const { data, error } = await supabase
        .from('equipment_maintenance_log')
        .select('*')
        .eq('tool_id', toolId)
        .order('performed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!toolId,
  });
}

export function useAddMaintenanceLog() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (log: {
      site_id: string;
      tool_id: string;
      maintenance_type: string;
      description?: string;
      performed_by?: string;
      performed_at: string;
      next_due_date?: string;
      cost?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'equipment_maintenance_log',
        payload: { ...log, created_by: user.id },
        description: `Maintenance: ${log.maintenance_type}`,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs', variables.tool_id] });
    },
  });
}

export interface EquipmentEfficiency {
  utilizationPercent: number; // share of the last 30 days spent actively running (excludes paused/lunch gaps)
  totalHoursAllTime: number;
  hoursToday: number;
  costPerHour: number | null; // the contractor's set rate - null for a foreman session, or if no rate was set
  runningCostToday: number | null; // hoursToday * costPerHour - null wherever costPerHour is
  totalMaintenanceCost: number;
  nextDueDate: string | null;
  maintenanceDue: boolean;
}

// Hours now come from tool_usage_session/tool_usage_event (start/pause/
// resume/stop), not the retired plant checkout log - a lunch pause
// contributes no interval, so it's excluded automatically rather than
// subtracted after the fact. costPerHour/runningCost are the contractor's
// set rate, so they come back null under a foreman session (foreman reads
// route through tool_inventory_foreman, which has no cost_per_hour column
// to select in the first place - this hook only asks for it when isContractor).
export function useEquipmentEfficiency(siteId: string | undefined) {
  const { isContractor } = useAuth();

  return useQuery({
    queryKey: ['equipmentEfficiency', siteId, isContractor],
    queryFn: async (): Promise<Record<string, EquipmentEfficiency>> => {
      if (!siteId) return {};

      const toolsQuery = isContractor
        ? supabase.from('tool_inventory').select('id, cost_per_hour').eq('site_id', siteId).eq('category', 'plant')
        : supabase.from('tool_inventory_foreman').select('id').eq('site_id', siteId).eq('category', 'plant');

      const [toolsRes, sessionsRes, eventsRes, maintenanceRes] = await Promise.all([
        toolsQuery,
        supabase.from('tool_usage_session').select('id, tool_id, started_at, session_date').eq('site_id', siteId),
        supabase
          .from('tool_usage_event')
          .select('session_id, event_type, event_at, tool_usage_session!inner(tool_id, site_id)')
          .eq('tool_usage_session.site_id', siteId),
        supabase.from('equipment_maintenance_log').select('tool_id, cost, next_due_date').eq('site_id', siteId),
      ]);
      if (toolsRes.error) throw toolsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (maintenanceRes.error) throw maintenanceRes.error;

      const now = Date.now();
      const windowStart = now - 30 * 24 * 60 * 60 * 1000;
      const todayStr = new Date().toISOString().slice(0, 10);
      const result: Record<string, EquipmentEfficiency> = {};

      for (const tool of toolsRes.data ?? []) {
        const toolSessions = (sessionsRes.data ?? []).filter((s) => s.tool_id === tool.id);
        let hoursAllTime = 0;
        let hoursLast30 = 0;
        let hoursToday = 0;

        for (const session of toolSessions) {
          const sessionEvents = (eventsRes.data ?? [])
            .filter((e) => e.session_id === session.id)
            .sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime());
          const activeSeconds = activeSecondsFromEvents(sessionEvents as UsageEvent[], now);
          const activeHours = activeSeconds / 3600;
          hoursAllTime += activeHours;
          if (new Date(session.started_at).getTime() >= windowStart) hoursLast30 += activeHours;
          if (session.session_date === todayStr) hoursToday += activeHours;
        }

        const maintLogs = (maintenanceRes.data ?? []).filter((m) => m.tool_id === tool.id);
        const totalMaintenanceCost = maintLogs.reduce((sum, m) => sum + Number(m.cost ?? 0), 0);
        const dueDates = maintLogs.map((m) => m.next_due_date).filter((d): d is string => !!d).sort();

        const costPerHour = isContractor ? (tool as { cost_per_hour: number | null }).cost_per_hour : null;

        result[tool.id] = {
          utilizationPercent: Math.min(100, (hoursLast30 / (30 * 24)) * 100),
          totalHoursAllTime: hoursAllTime,
          hoursToday,
          costPerHour,
          runningCostToday: costPerHour != null ? hoursToday * costPerHour : null,
          totalMaintenanceCost,
          nextDueDate: dueDates[0] ?? null,
          maintenanceDue: dueDates[0] ? isExpiringSoon(dueDates[0]) : false,
        };
      }

      return result;
    },
    enabled: !!siteId,
  });
}