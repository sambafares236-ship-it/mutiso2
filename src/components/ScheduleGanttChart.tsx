import { useState } from 'react';
import { buildActivityTree, type Activity } from '@/hooks/useActivities';
import type { ScheduleProgressItem, ScheduleClassification } from '@/hooks/useScheduleProgress';

interface ScheduleGanttChartProps {
  activities: Activity[];
  progressItems: ScheduleProgressItem[];
}

const DAY_WIDTH = 6; // px/day - fits a ~9 month project in a reasonable scrollable width
const LABEL_WIDTH = 152;
const ROW_HEIGHT = 32;

// Bars are colored by schedule status when a baseline exists (reusing the
// same success/muted/destructive tokens as the summary chart and the
// classification chips), or a neutral steel tone when there's no baseline
// yet to compare against.
const BAR_CLASS: Record<ScheduleClassification, string> = {
  ahead: 'bg-success',
  on_track: 'bg-muted-foreground/50',
  behind: 'bg-destructive',
  unknown: 'bg-muted-foreground/30',
};
const NO_BASELINE_BAR_CLASS = 'bg-muted-foreground/30';

function dayOffset(dateStr: string, rangeStart: Date): number {
  return Math.round((new Date(dateStr).getTime() - rangeStart.getTime()) / 86400000);
}

export function ScheduleGanttChart({ activities, progressItems }: ScheduleGanttChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const tree = buildActivityTree(activities);
  const dated = tree.filter((a) => a.planned_start && a.planned_end);

  if (!dated.length) {
    return <p className="text-sm text-muted-foreground p-4">No activities with both a planned start and end date yet.</p>;
  }

  const starts = dated.map((a) => new Date(a.planned_start as string).getTime());
  const ends = dated.map((a) => new Date(a.planned_end as string).getTime());
  const rangeStart = new Date(Math.min(...starts));
  const rangeEnd = new Date(Math.max(...ends));
  const totalDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000));
  const chartWidth = totalDays * DAY_WIDTH;

  const months: { label: string; offsetDays: number }[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cursor <= rangeEnd) {
    months.push({
      label: cursor.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' }),
      offsetDays: dayOffset(cursor.toISOString().split('T')[0], rangeStart),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const today = new Date().toISOString().split('T')[0];
  const todayOffset = dayOffset(today, rangeStart);
  const todayInRange = todayOffset >= 0 && todayOffset <= totalDays;

  const progressById = new Map(progressItems.map((p) => [p.activityId, p]));
  const hovered = hoveredId ? dated.find((a) => a.id === hoveredId) : null;
  const hoveredItem = hoveredId ? progressById.get(hoveredId) : undefined;

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <div style={{ width: LABEL_WIDTH + chartWidth }}>
        {/* Month header */}
        <div className="flex border-b border-border">
          <div className="shrink-0 sticky left-0 z-10 bg-card" style={{ width: LABEL_WIDTH }} />
          <div className="relative h-6" style={{ width: chartWidth }}>
            {months.map((m) => (
              <div
                key={m.label + m.offsetDays}
                className="absolute top-0 h-full border-l border-border/60 pl-1 text-[10px] text-muted-foreground whitespace-nowrap"
                style={{ left: m.offsetDays * DAY_WIDTH }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="flex">
          <div className="shrink-0 sticky left-0 z-10 bg-card" style={{ width: LABEL_WIDTH }}>
            {dated.map((a) => (
              <div
                key={a.id}
                className="flex items-center border-b border-border/40 last:border-b-0 text-xs text-foreground truncate pr-2"
                style={{ height: ROW_HEIGHT, paddingLeft: 8 + a.depth * 12 }}
                title={a.name}
              >
                {a.name}
              </div>
            ))}
          </div>
          <div className="relative" style={{ width: chartWidth, height: dated.length * ROW_HEIGHT }}>
            {todayInRange && (
              <div
                className="absolute top-0 bottom-0 w-px bg-primary z-10"
                style={{ left: todayOffset * DAY_WIDTH }}
                title={`Today — ${today}`}
              />
            )}
            {dated.map((a, i) => {
              const item = progressById.get(a.id);
              const barClass = item ? BAR_CLASS[item.classification] : NO_BASELINE_BAR_CLASS;
              const left = dayOffset(a.planned_start as string, rangeStart) * DAY_WIDTH;
              const width = Math.max(4, dayOffset(a.planned_end as string, rangeStart) * DAY_WIDTH - left);
              return (
                <div
                  key={a.id}
                  className="absolute left-0 right-0 border-b border-border/40 last:border-b-0"
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                >
                  <div
                    className={`absolute top-1.5 rounded ${barClass}`}
                    style={{ left, width, height: ROW_HEIGHT - 12 }}
                    onMouseEnter={() => setHoveredId(a.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                </div>
              );
            })}
            {hovered && (
              <div
                className="absolute z-20 bg-popover border border-border rounded-md px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap pointer-events-none"
                style={{
                  left: Math.min(dayOffset(hovered.planned_start as string, rangeStart) * DAY_WIDTH, chartWidth - 180),
                  top: (dated.indexOf(hovered) + 1) * ROW_HEIGHT,
                }}
              >
                <p className="font-medium text-foreground">{hovered.name}</p>
                <p className="text-muted-foreground">
                  {hovered.planned_start} → {hovered.planned_end}
                </p>
                {hoveredItem && <p className="text-muted-foreground capitalize">{hoveredItem.classification.replace('_', ' ')}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
