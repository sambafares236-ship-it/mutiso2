import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ClipboardList, X, Loader2 } from 'lucide-react';
import { useAddDiaryEntry } from '@/hooks/useDiary';
import { useSiteActivities } from '@/hooks/useActivities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NO_ACTIVITY = '__none__';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().min(1),
  date: z.string().min(1),
  activity_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface DiaryFormProps {
  siteId: string;
  onClose: () => void;
}

export function DiaryForm({ siteId, onClose }: DiaryFormProps) {
  const addEntry = useAddDiaryEntry();
  const { data: activities } = useSiteActivities(siteId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'Activity', date: new Date().toISOString().split('T')[0], activity_id: NO_ACTIVITY },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await addEntry.mutateAsync({
        site_id: siteId,
        ...values,
        activity_id: values.activity_id === NO_ACTIVITY ? undefined : values.activity_id,
      });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Diary entry will sync once you\'re back online.' });
      } else {
        toast.success('Activity logged', { description: 'Site diary entry saved.' });
      }
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">SITE DIARY</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activity">Activity</SelectItem>
                    <SelectItem value="Inspection">Inspection</SelectItem>
                    <SelectItem value="Incident">Incident</SelectItem>
                    <SelectItem value="Delay">Delay</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {!!activities?.length && (
            <div className="space-y-2">
              <Label htmlFor="activity_id">Which activity? (optional)</Label>
              <Controller
                name="activity_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="activity_id">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ACTIVITY}>Not linked to a specific activity</SelectItem>
                      {activities.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.activity_code ? `${a.activity_code} ` : ''}
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="e.g., Foundation pour completed" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Details of what happened today..." rows={4} {...register('description')} />
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              'LOG ACTIVITY'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
