import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Upload, X, AlertTriangle, Loader2, FileUp } from 'lucide-react';
import { useReplaceActivities, type UploadedActivity } from '@/hooks/useActivities';
import { Button } from '@/components/ui/button';

interface ScheduleUploadDialogProps {
  siteId: string;
  existingCount: number;
  onClose: () => void;
}

// Header aliases are matched case-insensitively after stripping anything
// that isn't a letter or space, so "Activity Code", "activity_code", and
// "WBS Code" all resolve the same way - schedules exported from different
// tools (Excel, MS Project, Primavera) rarely use identical column names.
const FIELD_ALIASES: Record<keyof Omit<UploadedActivity, 'name'> | 'name', string[]> = {
  name: ['name', 'activity name', 'task', 'task name', 'activity'],
  activity_code: ['code', 'activity code', 'wbs', 'wbs code', 'id', 'item code', 'outline number', 'outline code'],
  planned_start: ['start', 'start date', 'planned start', 'planned start date'],
  planned_end: ['end', 'end date', 'finish', 'finish date', 'planned end', 'planned end date'],
  responsible_party: ['responsible', 'responsible party', 'owner', 'assigned to'],
};

// Anything that isn't a letter becomes a space (not nothing) - MS Project's
// CSV export writes "Start_Date"/"Outline_Number", and deleting the separator
// instead of replacing it produced "startdate"/"outlinenumber", which matched
// no alias at all, so those columns silently imported as empty.
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
}

function matchColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => [h, normalizeHeader(h)] as const);
  for (const alias of aliases) {
    const match = normalized.find(([, n]) => n === alias);
    if (match) return match[0];
  }
  return null;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Formats from local calendar parts. Never use toISOString() here: a date
// parsed as local midnight in Kenya (UTC+3) serializes to the *previous*
// day in UTC, shifting every imported date back by one.
function toIsoDate(y: number, m: number, d: number): string | undefined {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Accepts ISO (YYYY-MM-DD) as-is; otherwise handles slash/dash dates with an
// optional weekday prefix and a 2- or 4-digit year ("Fri 10/31/25", the shape
// MS Project exports). Day/month order is genuinely ambiguous in a value like
// "4/2/26", so it's resolved in this order: an out-of-range component decides
// it outright; failing that, the weekday prefix decides it (only one reading
// can land on the stated day); failing that, DD/MM (this market's convention).
// Returns undefined - not an error - for anything it can't confidently parse,
// since a missing date shouldn't block the whole row from importing.
// Strips an optional weekday prefix and splits a slash/dash date into its
// numeric parts. Shared by detectDateOrder and parseDate so both read a value
// exactly the same way.
function dateParts(raw: string): { a: number; b: number; y: number; dow: number | null } | null {
  let value = raw.trim();
  let dow: number | null = null;
  const prefix = value.match(/^([a-z]{3,9})\.?,?\s+/i);
  if (prefix) {
    const idx = WEEKDAYS.indexOf(prefix[1].slice(0, 3).toLowerCase());
    if (idx !== -1) {
      dow = idx;
      value = value.slice(prefix[0].length).trim();
    }
  }
  const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!m) return null;
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    y: m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]),
    dow,
  };
}

// A single export uses ONE date order throughout, so decide it once for the
// whole file rather than per row. Any row with a component above 12 settles it
// outright ("10/31/25" can only be M/D). Deciding per row is what produced a
// real four-month error: MS Project's "Sat 5/9/26" is 9 May, but BOTH readings
// (9 May and 5 Sep 2026) fall on a Saturday, so the weekday tiebreak below
// can't separate them and the DD/MM fallback silently won. That misdates
// roughly every seventh ambiguous value.
export function detectDateOrder(values: (string | undefined)[]): 'mdy' | 'dmy' | null {
  let mdy = 0;
  let dmy = 0;
  for (const v of values) {
    if (!v) continue;
    const p = dateParts(v);
    if (!p) continue;
    if (p.b > 12 && p.a <= 12) mdy++;
    else if (p.a > 12 && p.b <= 12) dmy++;
  }
  if (mdy > 0 && dmy === 0) return 'mdy';
  if (dmy > 0 && mdy === 0) return 'dmy';
  return null; // no evidence, or genuinely mixed - fall back to per-row logic
}

function parseDate(raw: string | undefined, order: 'mdy' | 'dmy' | null = null): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parts = dateParts(value);
  if (parts) {
    const { a, b, y, dow: expectedDow } = parts;

    const asDmy = toIsoDate(y, b, a);
    const asMdy = toIsoDate(y, a, b);

    // 1. An out-of-range component is definitive for this row.
    if (a > 12 && asDmy) return asDmy;
    if (b > 12 && asMdy) return asMdy;
    // 2. The order proven by the rest of the file outranks the weekday hint -
    //    it is derived from unambiguous rows, and a file does not mix orders.
    if (order === 'mdy' && asMdy) return asMdy;
    if (order === 'dmy' && asDmy) return asDmy;
    // 3. Only one reading landing on the stated weekday settles it.
    if (expectedDow !== null) {
      const dmyMatches = asDmy && new Date(y, b - 1, a).getDay() === expectedDow;
      const mdyMatches = asMdy && new Date(y, a - 1, b).getDay() === expectedDow;
      if (dmyMatches && !mdyMatches) return asDmy;
      if (mdyMatches && !dmyMatches) return asMdy;
    }
    // 4. Fall back to this market's convention.
    if (asDmy) return asDmy;
    if (asMdy) return asMdy;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return undefined;
}

// Mirrors the server-side prefix logic in replace_site_activities() - the
// parent of "1.2.3" is "1.2". Used here only to preview indentation and
// flag codes that won't find a matching parent row, not to compute the
// actual parent_id (that happens server-side once real row ids exist).
function parentCode(code: string): string | null {
  const idx = code.lastIndexOf('.');
  return idx === -1 ? null : code.slice(0, idx);
}

function codeDepth(code: string | undefined): number {
  if (!code) return 0;
  return (code.match(/\./g) || []).length;
}

export function ScheduleUploadDialog({ siteId, existingCount, onClose }: ScheduleUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceActivities = useReplaceActivities();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<UploadedActivity[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setParsed([]);

    // Catch the wrong-file-type case up front with a specific, actionable
    // message - parsing an .mpp/.xlsx file as text produces garbage rows
    // with no recognizable headers, which used to surface as a confusing
    // generic "no activity name column found" error even though the real
    // problem was "this isn't a CSV at all."
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv')) {
      const exportHint = lowerName.endsWith('.mpp')
        ? 'In MS Project: File → Save As → choose "CSV (Comma delimited)" as the file type.'
        : lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')
          ? 'In Excel: File → Save As → choose "CSV (Comma delimited)" as the file type.'
          : 'Export/save it as CSV first, then upload that file.';
      setParseError(`"${file.name}" isn't a CSV file. ${exportHint}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const headers = result.meta.fields ?? [];

      const nameCol = matchColumn(headers, FIELD_ALIASES.name);
      if (!nameCol) {
        setParseError('Could not find an activity name column (expected a header like "Name" or "Activity Name").');
        setParsed([]);
        return;
      }
      const codeCol = matchColumn(headers, FIELD_ALIASES.activity_code);
      const startCol = matchColumn(headers, FIELD_ALIASES.planned_start);
      const endCol = matchColumn(headers, FIELD_ALIASES.planned_end);
      const responsibleCol = matchColumn(headers, FIELD_ALIASES.responsible_party);

      // Decide the file's date order once, from every date cell in it, before
      // parsing any individual row (see detectDateOrder).
      const dateOrder = detectDateOrder([
        ...(startCol ? result.data.map((r) => r[startCol]) : []),
        ...(endCol ? result.data.map((r) => r[endCol]) : []),
      ]);

      let skipped = 0;
      const rows: UploadedActivity[] = [];
      for (const row of result.data) {
        const name = row[nameCol]?.trim();
        if (!name) {
          skipped += 1;
          continue;
        }
        rows.push({
          name,
          activity_code: codeCol ? row[codeCol]?.trim() || undefined : undefined,
          planned_start: parseDate(startCol ? row[startCol] : undefined, dateOrder),
          planned_end: parseDate(endCol ? row[endCol] : undefined, dateOrder),
          responsible_party: responsibleCol ? row[responsibleCol]?.trim() || undefined : undefined,
        });
      }
      setParsed(rows);
      setSkippedCount(skipped);
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    try {
      const count = await replaceActivities.mutateAsync({ site_id: siteId, activities: parsed });
      toast.success('Schedule uploaded', { description: `${count} activities imported.` });
      onClose();
    } catch (err) {
      toast.error('Could not upload schedule', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">UPLOAD SCHEDULE</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV of your schedule of works. Export from Excel, Google Sheets, MS Project, or Primavera as CSV first if needed.
          Expected columns: <span className="text-foreground">Activity Name</span> (required), Code, Start Date, End Date, Responsible.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-2 p-4 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors mb-4"
        >
          <FileUp className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{fileName ?? 'Choose a CSV file'}</span>
        </button>

        {parseError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{parseError}</p>
          </div>
        )}

        {parsed.length > 0 && (
          <div className="space-y-3">
            {existingCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <p className="text-xs text-warning">
                  This replaces all {existingCount} existing activities on this site, including any progress already recorded.
                </p>
              </div>
            )}
            <p className="text-sm text-foreground">
              {parsed.length} activit{parsed.length === 1 ? 'y' : 'ies'} ready to import
              {skippedCount > 0 && `, ${skippedCount} row(s) skipped (no name)`}.
            </p>
            <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {(() => {
                const codes = new Set(parsed.map((r) => r.activity_code).filter(Boolean) as string[]);
                return parsed.map((row, i) => {
                  const depth = codeDepth(row.activity_code);
                  const pCode = row.activity_code ? parentCode(row.activity_code) : null;
                  const orphaned = !!pCode && !codes.has(pCode);
                  return (
                    <div
                      key={i}
                      className="p-2.5 text-xs border-b border-border last:border-b-0 bg-card"
                      style={{ paddingLeft: `${10 + depth * 16}px` }}
                    >
                      <p className="text-foreground font-medium">
                        {row.activity_code && <span className="text-muted-foreground mr-1">{row.activity_code}</span>}
                        {row.name}
                        {orphaned && <span className="ml-2 text-warning">(no matching parent code — will import top-level)</span>}
                      </p>
                      <p className="text-muted-foreground">
                        {row.planned_start ?? '—'} → {row.planned_end ?? '—'}
                        {row.responsible_party && ` · ${row.responsible_party}`}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
            <Button
              variant="construction"
              size="touch"
              className="w-full"
              onClick={handleConfirm}
              disabled={replaceActivities.isPending}
            >
              {replaceActivities.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Uploading...
                </>
              ) : (
                `REPLACE SCHEDULE WITH ${parsed.length} ACTIVITIES`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
