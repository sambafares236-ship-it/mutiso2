import { useState } from 'react';
import { toast } from 'sonner';
import { ClipboardCheck, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useInspectionTemplates, useSubmitInspection, type ChecklistItem, type ChecklistResult } from '@/hooks/useInspections';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface InspectionFormProps {
  siteId: string;
  onClose: () => void;
}

export function InspectionForm({ siteId, onClose }: InspectionFormProps) {
  const { data: templates, isLoading } = useInspectionTemplates();
  const submitInspection = useSubmitInspection();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [results, setResults] = useState<ChecklistResult[]>([]);
  const today = new Date().toISOString().split('T')[0];

  const selectTemplate = (id: string, items: unknown) => {
    setTemplateId(id);
    const parsedItems = (items as ChecklistItem[]) ?? [];
    setResults(parsedItems.map((item) => ({ label: item.label, pass: true })));
  };

  const toggleResult = (index: number) => {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, pass: !r.pass } : r)));
  };

  const flaggedCount = results.filter((r) => !r.pass).length;

  const handleSubmit = async () => {
    if (!templateId) return;
    try {
      const result = await submitInspection.mutateAsync({ site_id: siteId, template_id: templateId, date: today, results });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Inspection will sync once online.' });
      } else {
        toast.success('Inspection submitted', {
          description: flaggedCount > 0 ? `${flaggedCount} item(s) flagged.` : 'All items passed.',
        });
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
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">INSPECTION</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : !templateId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-2">Choose a checklist to run:</p>
            {templates?.map((template) => (
              <button
                key={template.id}
                onClick={() => selectTemplate(template.id, template.items)}
                className="w-full text-left p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all"
              >
                <p className="font-medium text-foreground">{template.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              {results.map((result, index) => (
                <button
                  key={result.label}
                  type="button"
                  onClick={() => toggleResult(index)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    result.pass ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      result.pass ? 'border-success bg-success' : 'border-destructive bg-destructive'
                    }`}
                  >
                    {result.pass ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <p className="font-medium text-foreground flex-1">{result.label}</p>
                  <span className="text-xs text-muted-foreground">{result.pass ? 'Pass' : 'Flagged'}</span>
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="construction"
              size="touch"
              className="w-full"
              onClick={handleSubmit}
              disabled={submitInspection.isPending}
            >
              {submitInspection.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Saving...
                </>
              ) : flaggedCount > 0 ? (
                `SUBMIT (${flaggedCount} FLAGGED)`
              ) : (
                'SUBMIT — ALL CLEAR'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
