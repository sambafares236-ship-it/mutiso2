import { useState, type CSSProperties, type ReactNode } from 'react';
import { buildActivityTree, type Activity } from '@/hooks/useActivities';
import type { ScheduleProgressItem, ScheduleClassification } from '@/hooks/useScheduleProgress';

interface ScheduleGanttChartProps {
  activities: Activity[];
  progressItems: ScheduleProgressItem[];
}

const DAY_WIDTH = 6; // px/day - fits a ~9 month project in a reasonable scrollable width
const LABEL_WIDTH = 152;
const ROW_HEIGHT = 32;

// Each bar carries two independent pieces of information, on two separate
// visual channels so neither has to be sacrificed for the other:
//
//   FILL  = work state. The planned span is drawn as a hollow track; the
//           filled portion is percent_complete. Empty track = pending,
//           part-filled = ongoing, full = done. Fill colour reinforces it
//           (success green = done, brand yellow = ongoing).
//   OUTLINE + TAIL = schedule state. A success/destructive ring says ahead
//           or late; a hatched red tail past the planned end shows how far
//           an overdue, still-open activity has run over.
//
// Keeping them separate is what lets a bar say "half done AND late" - a
// single colour scale can only ever say one of the two.
type WorkState = 'done' | 'ongoing' | 'pending';

const WORK_FILL: Record<WorkState, string> = {
  done: 'bg-success',
  ongoing: 'bg-primary',
  pending: 'bg-transparent',
};

const SCHEDULE_RING: Record<ScheduleClassification, string> = {
  ahead: 'ring-1 ring-success',
  on_track: '',
  behind: 'ring-1 ring-destructive',
  unknown: '',
};

const SCHEDULE_LABEL: Record<ScheduleClassification, string> = {
  ahead: 'Ahead of schedule',
  on_track: 'On time',
  behind: 'Late',
  unknown: 'No baseline',
};

// Diagonal hatch for the overdue tail - deliberately a texture, not just
// another solid colour, so it never reads as "more work done".
const OVERDUE_TAIL_STYLE: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, hsl(var(--destructive) / 0.55) 0 3px, transparent 3px 6px)',
};

function dayOffset(dateStr: string, rangeStart: Date): number {
  return Math.round((new Date(dateStr).getTime() - rangeStart.getTime()) / 86400000);
}

function workState(activity: Activity): WorkState {
  const percent = activity.percent_complete ?? 0;
  if (activity.actual_end || activity.status === 'completed' || percent >= 100) return 'done';
  if (percent > 0 || activity.status === 'in_progress' || activity.actual_start) return 'ongoing';
  return 'pending';
}

// Without a baseline there's no classification to read, but an open
// activity whose planned end has already passed is still unambiguously
// late - fall back to the live dates in that case.
function scheduleState(
  activity: Activity,
  item: ScheduleProgressItem | undefined,
  today: string,
): ScheduleClassification {
  if (item && item.classification !== 'unknown') return item.classification;
  const overdue = workState(activity) !== 'done' && (activity.planned_end as string) < today;
  return overdue ? 'behind' : 'unknown';
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
  const today = new Date().toISOString().split('T')[0];
  const todayOffset = dayOffset(today, rangeStart);
  const totalDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000));
  // An overdue tail can run past the last planned end date - widen the
  // chart so it isn't clipped.
  const chartDays = Math.max(totalDays, todayOffset);
  const chartWidth = chartDays * DAY_WIDTH;

  const months: { label: string; offsetDays: number }[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cursor.getTime() <= rangeStart.getTime() + chartDays * 86400000) {
    months.push({
      label: cursor.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' }),
      offsetDays: dayOffset(cursor.toISOString().split('T')[0], rangeStart),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const todayInRange = todayOffset >= 0 && todayOffset <= chartDays;

  const progressById = new Map(progressItems.map((p) => [p.activityId, p]));
  const hovered = hoveredId ? dated.find((a) => a.id === hoveredId) : null;
  const hoveredItem = hoveredId ? progressById.get(hoveredId) : undefined;

  return (
    <div className="space-y-2">
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
                const state = workState(a);
                const percent = state === 'done' ? 100 : Math.max(0, Math.min(100, a.percent_complete ?? 0));
                const classification = scheduleState(a, item, today);
                const overdue = state !== 'done' && (a.planned_end as string) < today;

                const left = dayOffset(a.planned_start as string, rangeStart) * DAY_WIDTH;
                const endOffset = dayOffset(a.planned_end as string, rangeStart);
                const width = Math.max(4, endOffset * DAY_WIDTH - left);
                const tailWidth = overdue && todayInRange ? Math.max(0, (todayOffset - endOffset) * DAY_WIDTH) : 0;

                return (
                  <div
                    key={a.id}
                    className="absolute left-0 right-0 border-b border-border/40 last:border-b-0"
                    style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                  >
                    {tailWidth > 0 && (
                      <div
                        className="absolute top-1.5 rounded-r border border-l-0 border-destructive/50"
                        style={{ ...OVERDUE_TAIL_STYLE, left: left + width, width: tailWidth, height: ROW_HEIGHT - 12 }}
                        onMouseEnter={() => setHoveredId(a.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    )}
                    <div
                      className={`absolute top-1.5 rounded border border-border/70 bg-muted/40 overflow-hidden ${SCHEDULE_RING[classification]}`}
                      style={{ left, width, height: ROW_HEIGHT - 12 }}
                      onMouseEnter={() => setHoveredId(a.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {percent > 0 && (
                        <div className={`h-full ${WORK_FILL[state]}`} style={{ width: `${percent}%` }} />
                      )}
                    </div>
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
                  <p className="text-muted-foreground">
                    {workState(hovered) === 'done'
                      ? 'Done'
                      : workState(hovered) === 'ongoing'
                        ? `Ongoing — ${Math.round(hovered.percent_complete ?? 0)}%`
                        : 'Not started'}
                    {' · '}
                    {SCHEDULE_LABEL[scheduleState(hovered, hoveredItem, today)]}
                  </p>
                  {hoveredItem?.delayDays != null && hoveredItem.delayDays > 0 && (
                    <p className="text-destructive">{hoveredItem.delayDays} day{hoveredItem.delayDays === 1 ? '' : 's'} behind</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <GanttLegend />
    </div>
  );
}

function GanttLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground px-1">
      <LegendSwatch label="Done">
        <div className="w-full h-full bg-success" />
      </LegendSwatch>
      <LegendSwatch label="Ongoing">
        <div className="h-full bg-primary" style={{ width: '55%' }} />
      </LegendSwatch>
      <LegendSwatch label="Not started" />
      <LegendSwatch label="Ahead" ring="ring-1 ring-success">
        <div className="h-full bg-primary" style={{ width: '70%' }} />
      </LegendSwatch>
      <LegendSwatch label="Late" ring="ring-1 ring-destructive">
        <div className="h-full bg-primary" style={{ width: '30%' }} />
      </LegendSwatch>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-6 h-3 rounded-sm border border-destructive/50"
          style={OVERDUE_TAIL_STYLE}
        />
        Overrun to date
      </span>
    </div>
  );
}

function LegendSwatch({ label, ring = '', children }: { label: string; ring?: string; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-6 h-3 rounded-sm border border-border/70 bg-muted/40 overflow-hidden ${ring}`}>
        {children}
      </span>
      {label}
    </span>
  );
}
