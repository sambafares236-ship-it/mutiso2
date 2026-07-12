import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { useUploadPhoto } from '@/hooks/usePhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  caption: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface PhotoFormProps {
  siteId: string;
  onClose: () => void;
}

export function PhotoForm({ siteId, onClose }: PhotoFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const uploadPhoto = useUploadPhoto();

  const {
    handleSubmit,
    register,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = async (values: FormValues) => {
    if (!selectedFile) {
      toast.error('No photo selected', { description: 'Choose a photo first.' });
      return;
    }
    try {
      // Photos tile is progress-only now - defects/incidents/deliveries
      // each got their own dedicated photo field on their own record
      // instead of relying on this shared tile's category tag.
      await uploadPhoto.mutateAsync({ siteId, file: selectedFile, category: 'progress', caption: values.caption });
      toast.success('Photo uploaded');
      onClose();
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Check your connection and try again.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">PHOTOS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors overflow-hidden"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Selected preview" className="w-full h-full object-cover" />
            ) : (
              <>
                <ImagePlus className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Tap to choose a photo</p>
              </>
            )}
          </button>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Input id="caption" placeholder="Optional note about this photo" {...register('caption')} />
          </div>

          <Button
            type="submit"
            variant="construction"
            size="touch"
            className="w-full"
            disabled={isSubmitting || !selectedFile}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Uploading...
              </>
            ) : (
              'UPLOAD PHOTO'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
