import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ClipboardList, X, Loader2, ImagePlus } from 'lucide-react';
import { useAddDiaryEntry } from '@/hooks/useDiary';
import { useUploadPhoto } from '@/hooks/usePhotos';
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

interface PendingPhoto {
  file: File;
  previewUrl: string;
}

export function DiaryForm({ siteId, onClose }: DiaryFormProps) {
  const addEntry = useAddDiaryEntry();
  const uploadPhoto = useUploadPhoto();
  const { data: activities } = useSiteActivities(siteId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'Activity', date: new Date().toISOString().split('T')[0], activity_id: NO_ACTIVITY },
  });

  // Revoke every preview object URL on unmount so a form left open with
  // several photos selected doesn't leak memory.
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await addEntry.mutateAsync({
        site_id: siteId,
        ...values,
        activity_id: values.activity_id === NO_ACTIVITY ? undefined : values.activity_id,
      });

      if (result.queued) {
        toast.info('Saved offline', {
          description: photos.length
            ? "Diary entry will sync once you're back online. Photos couldn't be attached offline — add them again once it's synced."
            : "Diary entry will sync once you're back online.",
        });
        onClose();
        return;
      }

      const diaryId = result.data?.id as string | undefined;
      if (photos.length && diaryId) {
        try {
          await Promise.all(
            photos.map((p) => uploadPhoto.mutateAsync({ siteId, file: p.file, category: 'diary', diaryId })),
          );
        } catch (photoErr) {
          toast.error('Entry saved, but a photo failed to upload', {
            description: photoErr instanceof Error ? photoErr.message : 'Check your connection and try again.',
          });
          onClose();
          return;
        }
      }

      toast.success('Activity logged', {
        description: photos.length ? 'Site diary entry and photos saved.' : 'Site diary entry saved.',
      });
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

          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <div key={photo.previewUrl} className="relative aspect-square">
                  <img
                    src={photo.previewUrl}
                    alt={`Selected photo ${i + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-destructive text-destructive-foreground shadow-sm"
                    aria-label="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors"
              >
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Add</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              These photos will appear together with this entry's description on the contractor's dashboard.
            </p>
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
