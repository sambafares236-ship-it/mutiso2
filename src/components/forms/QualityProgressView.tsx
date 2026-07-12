import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DefectsPanel } from './DefectsView';
import { PermitsPanel } from './PermitsView';

interface QualityProgressViewProps {
  siteId: string;
  onClose: () => void;
}

// One combined screen for the two Quality & Progress concerns - same
// tab-switcher pattern as BudgetView's Budget/Actual Costs tabs. Reuses
// DefectsPanel/PermitsPanel (the content extracted out of DefectsView/
// PermitsView) rather than duplicating any list/form logic.
export function QualityProgressView({ siteId, onClose }: QualityProgressViewProps) {
  const [tab, setTab] = useState<'defects' | 'permits'>('defects');

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Flag className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">QUALITY & PROGRESS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => setTab('defects')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'defects' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Defects
          </button>
          <button
            type="button"
            onClick={() => setTab('permits')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'permits' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Permits
          </button>
        </div>

        {tab === 'defects' ? <DefectsPanel siteId={siteId} /> : <PermitsPanel siteId={siteId} />}
      </div>
    </div>
  );
}
