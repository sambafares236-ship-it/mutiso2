import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';
import { isExpiringSoon } from './useCertifications';

export type Tool = Database['public']['Tables']['tool_inventory']['Row'];
export type ToolCheckoutLog = Database['public']['Tables']['tool_checkout_log']['Row'];
export type MaintenanceLog = Database['public']['Tables']['equipment_maintenance_log']['Row'];

export function useSiteTools(siteId: string | undefined) {
  return useQuery({
    queryKey: ['tools', siteId],
    queryFn: async (): Promise<Tool[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase.from('tool_inventory').select('*').eq('site_id', siteId).order('tool_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
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
  utilizationPercent: number; // share of the last 30 days spent checked out
  totalHoursAllTime: number;
  costPerHour: number | null; // null when there's no usage time to divide by
  totalMaintenanceCost: number;
  nextDueDate: string | null;
  maintenanceDue: boolean;
}

// The three efficiency metrics the user asked for, computed entirely
// from checkout/return TIMESTAMPS (always present) plus maintenance
// records - deliberately not from meter readings, which are optional and
// often never filled in. A site with zero meter data still gets working
// utilization/cost-per-hour/maintenance-due figures.
export function useEquipmentEfficiency(siteId: string | undefined) {
  return useQuery({
    queryKey: ['equipmentEfficiency', siteId],
    queryFn: async (): Promise<Record<string, EquipmentEfficiency>> => {
      if (!siteId) return {};

      const [toolsRes, checkoutsRes, maintenanceRes] = await Promise.all([
        supabase.from('tool_inventory').select('id').eq('site_id', siteId).eq('category', 'plant'),
        supabase.from('tool_checkout_log').select('tool_id, checked_out_at, returned_at').eq('site_id', siteId),
        supabase.from('equipment_maintenance_log').select('tool_id, cost, next_due_date').eq('site_id', siteId),
      ]);
      if (toolsRes.error) throw toolsRes.error;
      if (checkoutsRes.error) throw checkoutsRes.error;
      if (maintenanceRes.error) throw maintenanceRes.error;

      const now = Date.now();
      const windowStart = now - 30 * 24 * 60 * 60 * 1000;
      const result: Record<string, EquipmentEfficiency> = {};

      for (const tool of toolsRes.data ?? []) {
        const checkouts = (checkoutsRes.data ?? []).filter((c) => c.tool_id === tool.id);
        let hoursLast30 = 0;
        let hoursAllTime = 0;
        for (const c of checkouts) {
          const start = new Date(c.checked_out_at).getTime();
          const end = c.returned_at ? new Date(c.returned_at).getTime() : now;
          hoursAllTime += (end - start) / (1000 * 60 * 60);
          const overlapStart = Math.max(start, windowStart);
          const overlapEnd = Math.min(end, now);
          if (overlapEnd > overlapStart) hoursLast30 += (overlapEnd - overlapStart) / (1000 * 60 * 60);
        }

        const maintLogs = (maintenanceRes.data ?? []).filter((m) => m.tool_id === tool.id);
        const totalMaintenanceCost = maintLogs.reduce((sum, m) => sum + Number(m.cost ?? 0), 0);
        const dueDates = maintLogs.map((m) => m.next_due_date).filter((d): d is string => !!d).sort();

        result[tool.id] = {
          utilizationPercent: Math.min(100, (hoursLast30 / (30 * 24)) * 100),
          totalHoursAllTime: hoursAllTime,
          costPerHour: hoursAllTime > 0 ? totalMaintenanceCost / hoursAllTime : null,
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
