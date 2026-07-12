interface ScheduleSummaryChartProps {
  ahead: number;
  onTrack: number;
  behind: number;
  overallPercent: number;
}

// Status color -> mark, reusing the same success/muted/destructive tokens
// the classification chips elsewhere in this view already use, so the
// chart and the per-activity badges read as one system rather than two
// separate color choices for the same three states.
function ProgressRing({ percent, size = 64, stroke = 7 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(clamped)}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="text-secondary" stroke="currentColor" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="text-primary transition-[stroke-dashoffset] duration-500"
        stroke="currentColor"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fill-foreground font-display text-base">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

export function ScheduleSummaryChart({ ahead, onTrack, behind, overallPercent }: ScheduleSummaryChartProps) {
  const total = ahead + onTrack + behind;
  const segments = [
    { key: 'ahead', count: ahead, className: 'bg-success', label: 'Ahead' },
    { key: 'on_track', count: onTrack, className: 'bg-muted-foreground/40', label: 'On track' },
    { key: 'behind', count: behind, className: 'bg-destructive', label: 'Behind' },
  ] as const;

  return (
    <div className="flex items-center gap-4">
      <ProgressRing percent={overallPercent} />
      <div className="flex-1 space-y-2">
        <div
          className="h-2.5 rounded-full bg-secondary overflow-hidden flex gap-0.5"
          role="img"
          aria-label={`${ahead} ahead, ${onTrack} on track, ${behind} behind`}
        >
          {total === 0 ? (
            <div className="w-full bg-muted-foreground/20" />
          ) : (
            segments
              .filter((s) => s.count > 0)
              .map((s) => <div key={s.key} className={`${s.className} h-full`} style={{ flexBasis: `${(s.count / total) * 100}%` }} />)
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${s.className}`} />
              {s.label} <span className="text-foreground font-medium">{s.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
