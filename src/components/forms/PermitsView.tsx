import { useState } from 'react';
import { toast } from 'sonner';
import { FileCheck, X, Plus, Check, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSitePermits, useDecidePermit, PERMIT_TYPE_LABELS } from '@/hooks/usePermits';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermitForm } from './PermitForm';

interface PermitsViewProps {
  siteId: string;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-warning bg-warning/10',
  approved: 'border-success bg-success/10',
  rejected: 'border-destructive bg-destructive/10',
};

// List + request-form content, no outer overlay chrome - extracted so
// QualityProgressView can embed it directly inside a shared tabbed shell
// (alongside DefectsPanel), while PermitsView below still wraps it in a
// full-screen overlay for the foreman's standalone dashboard tile.
export function PermitsPanel({ siteId }: { siteId: string }) {
  const { isContractor } = useAuth();
  const { data: permits, isLoading } = useSitePermits(siteId);
  const decide = useDecidePermit();
  const [showRequestForm, setShowRequestForm] = useState(false);

  const handleDecide = async (permitId: string, approve: boolean, permitType: string) => {
    try {
      await decide.mutateAsync({ permitId, approve });
      toast.success(approve ? 'Permit approved' : 'Permit rejected', {
        description: PERMIT_TYPE_LABELS[permitType] ?? permitType,
      });
    } catch (err) {
      toast.error('Could not update permit', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div>
      {!isContractor && (
        <Button variant="outline" size="sm" className="mb-4" onClick={() => setShowRequestForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Request Permit
        </Button>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : !permits?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No permits requested yet.</p>
      ) : (
        <div className="space-y-3">
          {permits.map((permit) => (
            <div key={permit.id} className={`rounded-xl border-2 p-4 ${STATUS_STYLES[permit.status]}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-foreground">{PERMIT_TYPE_LABELS[permit.permit_type] ?? permit.permit_type}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{permit.status}</span>
              </div>
              {permit.description && <p className="text-sm text-muted-foreground mb-2">{permit.description}</p>}
              <p className="text-[10px] text-muted-foreground">Requested {new Date(permit.created_at).toLocaleDateString('en-KE')}</p>

              {permit.status === 'pending' && isContractor && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="construction"
                    onClick={() => handleDecide(permit.id, true, permit.permit_type)}
                    disabled={decide.isPending}
                  >
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecide(permit.id, false, permit.permit_type)}
                    disabled={decide.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showRequestForm && <PermitForm siteId={siteId} onClose={() => setShowRequestForm(false)} />}
    </div>
  );
}

export function PermitsView({ siteId, onClose }: PermitsViewProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <FileCheck className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">PERMITS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <PermitsPanel siteId={siteId} />
      </div>
    </div>
  );
}
