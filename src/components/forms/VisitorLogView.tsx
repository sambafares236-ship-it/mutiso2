import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ClipboardCheck, X, LogOut } from 'lucide-react';
import { useSiteVisitors, useSignInVisitor, useSignOutVisitor } from '@/hooks/useVisitors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  visitor_name: z.string().min(1, 'Visitor name is required'),
  company: z.string().optional(),
  purpose: z.string().optional(),
  host_name: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface VisitorLogViewProps {
  siteId: string;
  onClose: () => void;
}

function VisitorRow({ visitor }: { visitor: ReturnType<typeof useSiteVisitors>['data'] extends (infer T)[] | undefined ? T : never }) {
  const signOut = useSignOutVisitor();

  const handleSignOut = async () => {
    try {
      await signOut.mutateAsync(visitor.id);
      toast.success('Visitor signed out');
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="card-industrial p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm text-foreground">{visitor.visitor_name}</p>
          {visitor.company && <p className="text-xs text-muted-foreground">{visitor.company}</p>}
        </div>
        {!visitor.time_out ? (
          <Button size="sm" variant="outline" onClick={handleSignOut} disabled={signOut.isPending}>
            <LogOut className="w-3 h-3 mr-1" /> Sign out
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground uppercase">Signed out</span>
        )}
      </div>
      {visitor.purpose && <p className="text-xs text-muted-foreground mt-1">{visitor.purpose}</p>}
      <p className="text-[10px] text-muted-foreground mt-1">
        In: {new Date(visitor.time_in).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
        {visitor.time_out && ` · Out: ${new Date(visitor.time_out).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`}
        {visitor.host_name && ` · Host: ${visitor.host_name}`}
      </p>
    </div>
  );
}

export function VisitorLogView({ siteId, onClose }: VisitorLogViewProps) {
  const { data: visitors, isLoading } = useSiteVisitors(siteId);
  const signIn = useSignInVisitor();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await signIn.mutateAsync({ site_id: siteId, ...values });
      if (result.queued) {
        toast.info('Saved offline', { description: `${values.visitor_name} will sync once online.` });
      } else {
        toast.success('Visitor signed in');
      }
      reset();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const onSite = visitors?.filter((v) => !v.time_out) ?? [];
  const past = visitors?.filter((v) => v.time_out) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">VISITOR LOG</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card-industrial p-4 space-y-3 mb-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="visitor_name">Visitor Name *</Label>
            <Input id="visitor_name" placeholder="Full name" {...register('visitor_name')} />
            {errors.visitor_name && <p className="text-xs text-destructive">{errors.visitor_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" placeholder="e.g., NEMA Inspector, Client rep" {...register('company')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" placeholder="e.g., Site inspection" {...register('purpose')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="host_name">Host (who they're seeing)</Label>
            <Input id="host_name" {...register('host_name')} />
          </div>
          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            SIGN IN VISITOR
          </Button>
        </form>

        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : (
          <div className="space-y-4">
            {onSite.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">On site now ({onSite.length})</p>
                {onSite.map((v) => (
                  <VisitorRow key={v.id} visitor={v} />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">History</p>
                {past.map((v) => (
                  <VisitorRow key={v.id} visitor={v} />
                ))}
              </div>
            )}
            {!visitors?.length && <p className="text-sm text-muted-foreground text-center py-8">No visitors logged yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
