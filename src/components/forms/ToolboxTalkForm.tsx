import { useState } from 'react';
import { toast } from 'sonner';
import { HardHat, X, Check, Loader2 } from 'lucide-react';
import { useWorkers } from '@/hooks/useWorkers';
import { useCreateToolboxTalk } from '@/hooks/useToolboxTalks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface ToolboxTalkFormProps {
  siteId: string;
  onClose: () => void;
}

const SUGGESTED_TOPICS = [
  'Fall protection at height',
  'PPE compliance',
  'Electrical safety',
  'Excavation & trenching',
  'Housekeeping',
  'Weather-related hazards',
];

export function ToolboxTalkForm({ siteId, onClose }: ToolboxTalkFormProps) {
  const { data: workers, isLoading } = useWorkers(siteId);
  const createTalk = useCreateToolboxTalk();
  const [topic, setTopic] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const toggleWorker = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!topic.trim()) {
      toast.error('Topic is required');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Select at least one attendee');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createTalk.mutateAsync({
        site_id: siteId,
        topic: topic.trim(),
        date: today,
        worker_ids: Array.from(selectedIds),
      });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Toolbox talk will sync once online.' });
      } else {
        toast.success('Toolbox talk logged', { description: `${selectedIds.size} workers signed off.` });
      }
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <HardHat className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl text-primary">TOOLBOX TALK</h2>
              <p className="text-sm text-muted-foreground">{today}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          <Label htmlFor="topic">Topic *</Label>
          <Input
            id="topic"
            list="topic-suggestions"
            placeholder="e.g., Fall protection at height"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <datalist id="topic-suggestions">
            {SUGGESTED_TOPICS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Tap each worker who attended this briefing.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : !workers?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No workers registered yet — add workers via Attendance first.
          </p>
        ) : (
          <div className="space-y-3 mb-6">
            {workers.map((worker) => {
              const isSelected = selectedIds.has(worker.id);
              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => toggleWorker(worker.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    isSelected ? 'border-success bg-success/10' : 'border-border bg-card'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-success bg-success' : 'border-muted-foreground'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <p className="font-medium text-foreground">{worker.full_name}</p>
                </button>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="construction"
          size="touch"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Saving...
            </>
          ) : (
            `LOG TALK (${selectedIds.size} attended)`
          )}
        </Button>
      </div>
    </div>
  );
}
