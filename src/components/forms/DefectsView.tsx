import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wrench, X, Plus, CheckCircle2, ImagePlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteDefects, useMarkDefectFixed, useVerifyDefect, type Defect } from '@/hooks/useDefects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportDefectForm } from './ReportDefectForm';

interface DefectsViewProps {
  siteId: string;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'border-destructive bg-destructive/10 text-destructive',
  in_progress: 'border-warning bg-warning/10 text-warning',
  resolved: 'border-success bg-success/10 text-success',
};

// Both photo_url (report-time) and fixed_photo_url (proof of fix) are
// private-bucket paths - sign whichever are present per defect, same
// pattern as PettyCashHistoryView's receipt URLs.
function useDefectPhotoUrls(defects: Defect[] | undefined) {
  return useQuery({
    queryKey: ['defectPhotoUrls', defects?.map((d) => `${d.id}:${d.photo_url}:${d.fixed_photo_url}`).join(',')],
    queryFn: async () => {
      const urls: Record<string, { photo?: string; fixedPhoto?: string }> = {};
      await Promise.all(
        (defects ?? []).map(async (d) => {
          const entry: { photo?: string; fixedPhoto?: string } = {};
          if (d.photo_url) {
            const { data } = await supabase.storage.from('site-photos').createSignedUrl(d.photo_url, 60 * 60);
            entry.photo = data?.signedUrl;
          }
          if (d.fixed_photo_url) {
            const { data } = await supabase.storage.from('site-photos').createSignedUrl(d.fixed_photo_url, 60 * 60);
            entry.fixedPhoto = data?.signedUrl;
          }
          urls[d.id] = entry;
        }),
      );
      return urls;
    },
    enabled: !!defects?.length,
  });
}

function MarkFixedRow({ defectId }: { defectId: string }) {
  const markFixed = useMarkDefectFixed();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleConfirm = async () => {
    setUploading(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          const ext = photoFile.name.split('.').pop() ?? 'jpg';
          const path = `${defectId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, photoFile);
          if (uploadError) throw uploadError;
          photoUrl = path;
        } catch {
          toast.warning('Photo not uploaded', { description: 'Defect will still be marked fixed without it.' });
        }
      }
      await markFixed.mutateAsync({ defectId, photoUrl });
      toast.success('Marked as fixed', { description: 'Ready for someone else to verify.' });
      setShowForm(false);
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  if (!showForm) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
        Mark Fixed
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 mt-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center gap-2 p-2 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors"
      >
        <ImagePlus className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{photoFile ? photoFile.name : 'Attach proof of fix (optional)'}</span>
      </button>
      <div className="flex gap-2">
        <Button size="sm" variant="construction" onClick={handleConfirm} disabled={uploading || markFixed.isPending}>
          Confirm Fixed
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// The list + report-form content, with no outer overlay chrome of its
// own - extracted so QualityProgressView can embed it directly inside a
// shared tabbed shell (alongside PermitsPanel), while DefectsView below
// still wraps it in a full-screen overlay for the foreman's standalone
// dashboard tile.
export function DefectsPanel({ siteId }: { siteId: string }) {
  const { user, isContractor } = useAuth();
  const { data: defects, isLoading } = useSiteDefects(siteId);
  const { data: photoUrls } = useDefectPhotoUrls(defects);
  const verify = useVerifyDefect();
  const [showReportForm, setShowReportForm] = useState(false);

  const handleVerify = async (id: string) => {
    try {
      await verify.mutateAsync(id);
      toast.success('Defect verified and resolved');
    } catch (err) {
      // The verifier-not-fixer check surfaces here as an error if the
      // same user who fixed it tries to verify it.
      toast.error('Cannot verify', {
        description:
          err instanceof Error && err.message.includes('yourself')
            ? "You can't verify a defect you fixed yourself — someone else needs to confirm it."
            : err instanceof Error
              ? err.message
              : undefined,
      });
    }
  };

  return (
    <div>
      <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowReportForm(true)}>
        <Plus className="w-4 h-4 mr-1" /> Report Defect
      </Button>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : !defects?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No defects reported.</p>
      ) : (
        <div className="space-y-3">
          {defects.map((defect) => (
            <div key={defect.id} className={`rounded-xl border-2 p-4 ${STATUS_STYLES[defect.status]}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-foreground">{defect.location || 'Unspecified location'}</p>
                <span className="text-[10px] uppercase tracking-wide">{defect.status.replace('_', ' ')}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{defect.description}</p>

              {(photoUrls?.[defect.id]?.photo || photoUrls?.[defect.id]?.fixedPhoto) && (
                <div className="flex gap-2 mb-2">
                  {photoUrls[defect.id].photo && (
                    <a href={photoUrls[defect.id].photo} target="_blank" rel="noreferrer" title="Reported photo">
                      <img
                        src={photoUrls[defect.id].photo}
                        alt="Defect"
                        className="w-14 h-14 rounded-md object-cover border border-border hover:brightness-110 transition-[filter]"
                      />
                    </a>
                  )}
                  {photoUrls[defect.id].fixedPhoto && (
                    <a href={photoUrls[defect.id].fixedPhoto} target="_blank" rel="noreferrer" title="Proof of fix">
                      <img
                        src={photoUrls[defect.id].fixedPhoto}
                        alt="Proof of fix"
                        className="w-14 h-14 rounded-md object-cover border border-success hover:brightness-110 transition-[filter]"
                      />
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {defect.status === 'open' && <MarkFixedRow defectId={defect.id} />}
                {defect.status === 'in_progress' &&
                  (isContractor ? (
                    <Button size="sm" variant="outline" onClick={() => handleVerify(defect.id)} disabled={verify.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Verify
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Awaiting contractor verification</p>
                  ))}
                {defect.status === 'resolved' && (
                  <p className="text-xs text-muted-foreground">Resolved{defect.verified_by === user?.id ? ' by you' : ''}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showReportForm && <ReportDefectForm siteId={siteId} onClose={() => setShowReportForm(false)} />}
    </div>
  );
}

export function DefectsView({ siteId, onClose }: DefectsViewProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning/20 rounded-xl">
              <Wrench className="w-6 h-6 text-warning" />
            </div>
            <h2 className="font-display text-3xl text-primary">DEFECTS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <DefectsPanel siteId={siteId} />
      </div>
    </div>
  );
}
