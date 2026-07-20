import { useState } from 'react';
import {
  Truck,
  Hammer,
  ClipboardList,
  Users,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  HardHat,
  ClipboardCheck,
  FileCheck,
  Wrench,
  Flag,
  History,
  Cog,
  UserCheck,
  ShieldCheck,
  Leaf,
  Menu,
  ChevronRight,
  Banknote,
  Wallet,
  Package,
} from 'lucide-react';
import { useForemanSite } from '@/hooks/useSite';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { isSubscriptionExpired } from '@/hooks/useSubscriptionPayment';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AtAGlanceStats } from '@/components/AtAGlanceStats';
import { AttendanceForm } from '@/components/forms/AttendanceForm';
import { DeliveryForm } from '@/components/forms/DeliveryForm';
import { UsageForm } from '@/components/forms/UsageForm';
import { DiaryForm } from '@/components/forms/DiaryForm';
import { IncidentForm } from '@/components/forms/IncidentForm';
import { ToolboxTalkForm } from '@/components/forms/ToolboxTalkForm';
import { InspectionForm } from '@/components/forms/InspectionForm';
import { PermitsView } from '@/components/forms/PermitsView';
import { DefectsView } from '@/components/forms/DefectsView';
import { SiteReportView } from '@/components/forms/SiteReportView';
import { ToolsView } from '@/components/forms/ToolsView';
import { VisitorLogView } from '@/components/forms/VisitorLogView';
import { CertificationsView } from '@/components/forms/CertificationsView';
import { EnvironmentalView } from '@/components/forms/EnvironmentalView';
import { PayrollView } from '@/components/forms/PayrollView';
import { PettyCashForm } from '@/components/forms/PettyCashForm';
import { HeavyEquipmentView } from '@/components/forms/HeavyEquipmentView';
import { InventoryView } from '@/components/forms/InventoryView';

type FormType =
  | 'attendance'
  | 'delivery'
  | 'usage'
  | 'diary'
  | 'incident'
  | 'toolbox'
  | 'inspection'
  | 'permit'
  | 'defects'
  | 'report'
  | 'tools'
  | 'visitors'
  | 'certifications'
  | 'environmental'
  | 'payroll'
  | 'pettyCash'
  | 'heavyEquipment'
  | 'inventory'
  | null;

interface TileConfig {
  key: FormType;
  icon: React.ElementType;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
}

const OPERATIONS_TILES: TileConfig[] = [
  { key: 'attendance', icon: Users, label: 'Attendance', subtitle: 'Mark workers', color: 'text-purple-400', bg: 'bg-purple-400/15' },
  { key: 'delivery', icon: Truck, label: 'Materials in', subtitle: 'Log delivery', color: 'text-success', bg: 'bg-success/15' },
  { key: 'usage', icon: Hammer, label: 'Materials out', subtitle: 'Log usage', color: 'text-warning', bg: 'bg-warning/15' },
  // Sits directly after Materials in/out on purpose - in / out / what's left
  // reads as one group. Read-only: stock is derived from those two actions.
  { key: 'inventory', icon: Package, label: 'Stock', subtitle: "What's on site", color: 'text-cyan-400', bg: 'bg-cyan-400/15' },
  { key: 'diary', icon: ClipboardList, label: 'Site diary', subtitle: 'Log activity', color: 'text-pink-400', bg: 'bg-pink-400/15' },
  { key: 'tools', icon: Cog, label: 'Tools', subtitle: 'Check in/out', color: 'text-teal-400', bg: 'bg-teal-400/15' },
];

const FINANCE_TILES: TileConfig[] = [
  { key: 'payroll', icon: Banknote, label: 'Payroll', subtitle: 'Mark wages paid', color: 'text-success', bg: 'bg-success/15' },
  { key: 'pettyCash', icon: Wallet, label: 'Petty Cash', subtitle: 'Log cash spent', color: 'text-blue-400', bg: 'bg-blue-400/15' },
];

const HEAVY_EQUIPMENT_TILES: TileConfig[] = [
  { key: 'heavyEquipment', icon: Truck, label: 'Heavy Equipment', subtitle: 'Usage & maintenance', color: 'text-orange-400', bg: 'bg-orange-400/15' },
];

const SAFETY_TILES: TileConfig[] = [
  { key: 'incident', icon: AlertTriangle, label: 'Incident', subtitle: 'Report now', color: 'text-destructive', bg: 'bg-destructive/15' },
  { key: 'toolbox', icon: HardHat, label: 'Toolbox talk', subtitle: 'Log briefing', color: 'text-primary', bg: 'bg-primary/15' },
  { key: 'inspection', icon: ClipboardCheck, label: 'Inspection', subtitle: 'Run checklist', color: 'text-blue-400', bg: 'bg-blue-400/15' },
];

const QUALITY_TILES: TileConfig[] = [
  { key: 'defects', icon: Wrench, label: 'Defects', subtitle: 'Report & track', color: 'text-warning', bg: 'bg-warning/15' },
  { key: 'report', icon: History, label: 'Site History', subtitle: 'View history', color: 'text-blue-400', bg: 'bg-blue-400/15' },
  { key: 'permit', icon: FileCheck, label: 'Permits', subtitle: 'Request & track', color: 'text-orange-400', bg: 'bg-orange-400/15' },
];

const ASSET_TILES: TileConfig[] = [
  { key: 'visitors', icon: UserCheck, label: 'Visitor Log', subtitle: 'Sign in/out', color: 'text-purple-400', bg: 'bg-purple-400/15' },
  { key: 'certifications', icon: ShieldCheck, label: 'Certifications', subtitle: 'View expiry', color: 'text-primary', bg: 'bg-primary/15' },
];

const ENVIRONMENTAL_TILES: TileConfig[] = [
  { key: 'environmental', icon: Leaf, label: 'Environmental', subtitle: 'Waste & incidents', color: 'text-success', bg: 'bg-success/15' },
];

interface CategoryConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  tiles: TileConfig[];
}

// Sidebar categories, in the order they appear in the drawer. Daily
// Operations first and default-selected - attendance/materials/diary are
// what a foreman opens most.
const CATEGORIES: CategoryConfig[] = [
  { key: 'operations', label: 'Daily Operations', icon: ClipboardList, tiles: OPERATIONS_TILES },
  { key: 'finances', label: 'Finances', icon: Wallet, tiles: FINANCE_TILES },
  { key: 'safety', label: 'Safety & Compliance', icon: HardHat, tiles: SAFETY_TILES },
  { key: 'quality', label: 'Quality & Progress', icon: Flag, tiles: QUALITY_TILES },
  { key: 'heavyEquipment', label: 'Heavy Equipment', icon: Truck, tiles: HEAVY_EQUIPMENT_TILES },
  { key: 'assets', label: 'Assets & Access', icon: ShieldCheck, tiles: ASSET_TILES },
  { key: 'environmental', label: 'Environmental', icon: Leaf, tiles: ENVIRONMENTAL_TILES },
];

// Pro-exclusive tile keys and whole categories - kept as one small lookup
// rather than annotating each TileConfig, since only a handful of tiles
// need it. Matches the tier RLS gate (owns_pro_site/is_assigned_foreman_of_
// pro_site) added in the same change - hiding these here is a UX nicety,
// the database is what actually enforces it.
// Payroll (and Petty Cash, never listed here) are core money management -
// stays base-tier per explicit user decision, even though most other
// financial features (Budget, Payment Certs, Subcontractors) are Pro-only.
const PRO_ONLY_TILE_KEYS: FormType[] = ['tools', 'defects'];
const PRO_ONLY_CATEGORY_KEYS = ['heavyEquipment', 'assets', 'environmental'];

function getTierFilteredCategories(isPro: boolean): CategoryConfig[] {
  if (isPro) return CATEGORIES;
  return CATEGORIES.filter((c) => !PRO_ONLY_CATEGORY_KEYS.includes(c.key)).map((c) => ({
    ...c,
    tiles: c.tiles.filter((t) => !PRO_ONLY_TILE_KEYS.includes(t.key)),
  }));
}

function OfflineQueueBanner() {
  const { isOnline, pendingCount, failed, isFlushing, flush, dismissFailed } = useOfflineQueue();

  if (isOnline && pendingCount === 0 && failed.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
          <CloudOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">You're offline — entries are being saved locally.</p>
        </div>
      )}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-2 p-3 bg-warning/10 rounded-lg">
          <p className="text-sm text-warning">
            {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} waiting to sync
          </p>
          {isOnline && (
            <Button size="sm" variant="outline" onClick={() => flush()} disabled={isFlushing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isFlushing ? 'animate-spin' : ''}`} /> Sync now
            </Button>
          )}
        </div>
      )}
      {failed.map((op) => (
        <div key={op.id} className="flex items-center justify-between gap-2 p-3 bg-destructive/10 rounded-lg">
          <div className="min-w-0">
            <p className="text-sm text-destructive font-medium truncate">{op.description} failed to sync</p>
            <p className="text-xs text-muted-foreground truncate">{op.errorMessage}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => dismissFailed(op.id)}>
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}

function TileGrid({ title, tiles, onSelect }: { title: string; tiles: TileConfig[]; onSelect: (key: FormType) => void }) {
  return (
    <div className="mb-5">
      <p className="text-xs text-muted-foreground tracking-wide mb-2 uppercase">{title}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile, index) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.label}
              onClick={() => onSelect(tile.key)}
              className="flex flex-col items-center gap-2 p-3.5 bg-card rounded-xl border border-border hover:border-primary/50 active:scale-95 transition-all animate-scale-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className={`w-10 h-10 rounded-lg ${tile.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${tile.color}`} />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground leading-tight">{tile.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tile.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategorySidebar({
  categories,
  activeCategory,
  onSelect,
  open,
  onOpenChange,
}: {
  categories: CategoryConfig[];
  activeCategory: string;
  onSelect: (key: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border text-left">
          <SheetTitle className="font-display text-2xl text-primary tracking-wide">MUTISO.AI</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-2">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = category.key === activeCategory;
            return (
              <button
                key={category.key}
                onClick={() => {
                  onSelect(category.key);
                  onOpenChange(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors ${
                  isActive ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/20' : 'bg-secondary'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <span className="flex-1 text-left font-medium text-sm">{category.label}</span>
                <span className="text-xs text-muted-foreground">{category.tiles.length}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export default function ForemanDashboard() {
  const { data: site, isLoading } = useForemanSite();
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [activeCategory, setActiveCategory] = useState<string>('operations');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full max-w-lg space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="card-industrial p-6 max-w-lg w-full text-center">
        <p className="font-medium text-foreground mb-1">No site assigned yet</p>
        <p className="text-sm text-muted-foreground">Contact your contractor for an invite link.</p>
      </div>
    );
  }

  // The "Assigned foremen can view their site" RLS policy checks
  // site_assignments directly, not owns_site()/is_assigned_foreman() - so
  // this row (and its status/subscription_end) stays visible even once the
  // site is locked out, letting us show a clear reason instead of every
  // tile below silently rendering empty from RLS-filtered queries.
  if (site.status !== 'active' || isSubscriptionExpired(site.subscription_end)) {
    return (
      <div className="card-industrial p-6 max-w-lg w-full text-center">
        <p className="font-medium text-foreground mb-1">Site access paused</p>
        <p className="text-sm text-muted-foreground">
          {site.status !== 'active'
            ? 'This site is not currently active.'
            : 'This site’s subscription has expired.'}{' '}
          Talk to your contractor to restore access.
        </p>
      </div>
    );
  }

  const isPro = site.subscription_tier === 'pro';
  const categories = getTierFilteredCategories(isPro);
  const activeCategoryConfig = categories.find((c) => c.key === activeCategory) ?? categories[0];

  return (
    <div className="w-full max-w-lg">
      <CategorySidebar
        categories={categories}
        activeCategory={activeCategoryConfig.key}
        onSelect={setActiveCategory}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => setSidebarOpen(true)} className="flex-shrink-0">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-1">Menu</p>
          <p className="font-display text-lg text-foreground truncate leading-none">{activeCategoryConfig.label}</p>
        </div>
      </div>

      <div className="card-industrial p-4 mb-5">
        <p className="text-xs text-muted-foreground mb-1">Your assigned site</p>
        <p className="font-display text-2xl text-primary">{site.site_name}</p>
        {site.location && <p className="text-sm text-muted-foreground mt-1">{site.location}</p>}
      </div>

      <OfflineQueueBanner />

      <AtAGlanceStats siteId={site.id} />

      <TileGrid title={activeCategoryConfig.label} tiles={activeCategoryConfig.tiles} onSelect={setActiveForm} />

      {activeForm === 'attendance' && <AttendanceForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'delivery' && <DeliveryForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'usage' && <UsageForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'diary' && <DiaryForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'incident' && <IncidentForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'toolbox' && <ToolboxTalkForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'inspection' && <InspectionForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'permit' && <PermitsView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'defects' && <DefectsView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'report' && <SiteReportView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'tools' && <ToolsView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'visitors' && <VisitorLogView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'certifications' && <CertificationsView siteId={site.id} onClose={() => setActiveForm(null)} readOnly />}
      {activeForm === 'environmental' && <EnvironmentalView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'payroll' && <PayrollView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'pettyCash' && <PettyCashForm siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'heavyEquipment' && <HeavyEquipmentView siteId={site.id} onClose={() => setActiveForm(null)} />}
      {activeForm === 'inventory' && <InventoryView siteId={site.id} onClose={() => setActiveForm(null)} />}
    </div>
  );
}
