import { useState } from 'react';
import { toast } from 'sonner';
import { Users, X, Check, UserPlus, CloudOff } from 'lucide-react';
import { useWorkers } from '@/hooks/useWorkers';
import { useTodayAttendance, useMarkPresent, useUnmarkPresent } from '@/hooks/useAttendance';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddWorkerForm } from './AddWorkerForm';

interface AttendanceFormProps {
  siteId: string;
  onClose: () => void;
}

export function AttendanceForm({ siteId, onClose }: AttendanceFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const { data: workers, isLoading: workersLoading } = useWorkers(siteId);
  const { data: presentIds, isLoading: attendanceLoading } = useTodayAttendance(siteId);
  const markPresent = useMarkPresent();
  const unmarkPresent = useUnmarkPresent();

  const loading = workersLoading || attendanceLoading;
  const presentCount = presentIds?.size ?? 0;

  const toggleWorker = async (workerId: string, workerName: string) => {
    if (savingIds.has(workerId)) return;
    setSavingIds((prev) => new Set(prev).add(workerId));
    try {
      if (presentIds?.has(workerId)) {
        await unmarkPresent.mutateAsync({ siteId, workerId });
        toast.success('Unmarked', { description: `${workerName} removed from today's attendance.` });
      } else {
        const result = await markPresent.mutateAsync({ siteId, workerId });
        if (result.queued) {
          toast.info('Saved offline', { description: `${workerName} will sync once you're back online.` });
        } else {
          toast.success('Marked present', { description: `${workerName} recorded for today.` });
        }
      }
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(workerId);
        return next;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl text-primary">ATTENDANCE</h2>
              <p className="text-sm text-muted-foreground">{today}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Tap a worker to mark present — saves instantly, works offline too.
        </p>

        <div className="flex justify-between items-center mb-4">
          <div className="px-3 py-1.5 bg-success/10 rounded-full">
            <p className="text-sm font-medium text-success">{presentCount} present today</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddWorker(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Add Worker
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : !workers?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="mb-1">No workers registered yet</p>
            <p className="text-sm mb-4">Add your crew to start tracking attendance</p>
            <Button variant="construction" onClick={() => setShowAddWorker(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add your first worker
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {workers.map((worker) => {
              const isPresent = presentIds?.has(worker.id) ?? false;
              const isSaving = savingIds.has(worker.id);
              return (
                <button
                  key={worker.id}
                  onClick={() => toggleWorker(worker.id, worker.full_name)}
                  disabled={isSaving}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    isPresent ? 'border-success bg-success/10' : 'border-border bg-card'
                  } ${isSaving ? 'opacity-60' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      isPresent ? 'border-success bg-success' : 'border-muted-foreground'
                    }`}
                  >
                    {isSaving ? (
                      <CloudOff className="w-4 h-4 text-muted-foreground" />
                    ) : isPresent ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : null}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{worker.full_name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                        {worker.worker_id_number}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {worker.trade || 'General'} · KES {worker.daily_rate ?? 0}/day
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showAddWorker && (
        <AddWorkerForm siteId={siteId} onClose={() => setShowAddWorker(false)} onAdded={() => setShowAddWorker(false)} />
      )}
    </div>
  );
}
