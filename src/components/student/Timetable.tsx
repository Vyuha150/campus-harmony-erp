import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Coffee, FlaskConical, Hourglass, MapPin, User, UtensilsCrossed, XCircle } from 'lucide-react';
import { fetchApi } from '@/lib/apiService';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** One class in the weekly timetable (shape of GET /students/timetable). */
export interface TimetableSlot {
  id?: string;
  courseId?: string;
  courseCode: string;
  courseName: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string;
  type?: string;
  faculty?: string;
}

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The student's mark for one held class (GET /students/attendance/marks). */
export interface AttendanceMark {
  courseId: string;
  date: string;
  startTime: string;
  status: 'present' | 'absent' | 'late' | 'not_marked';
}

/** YYYY-MM-DD in the viewer's own time zone. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseYmd = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y!, m! - 1, d!); };
export const shiftDays = (v: string, days: number) => { const d = parseYmd(v); d.setDate(d.getDate() + days); return ymd(d); };
export const weekdayOf = (v: string) => parseYmd(v).toLocaleDateString('en-US', { weekday: 'long' });
/** Monday–Saturday of the week containing `v` (Sunday belongs to the week before). */
export const weekOf = (v: string) => {
  const monday = shiftDays(v, -((parseYmd(v).getDay() + 6) % 7));
  return WEEK_DAYS.map((_, i) => shiftDays(monday, i));
};

/** Marks for a date range; refetches when the range changes. */
export function useAttendanceMarks(from: string, to: string): AttendanceMark[] {
  const [marks, setMarks] = useState<AttendanceMark[]>([]);
  useEffect(() => {
    let alive = true;
    fetchApi<AttendanceMark[]>(`/students/attendance/marks?from=${from}&to=${to}`)
      .then((rows) => { if (alive) setMarks(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setMarks([]); });
    return () => { alive = false; };
  }, [from, to]);
  return marks;
}

export const markFor = (marks: AttendanceMark[] | undefined, slot: TimetableSlot, date: string) =>
  marks?.find((m) => m.date === date && m.startTime === slot.startTime && (!slot.courseId || m.courseId === slot.courseId));

const COLOURS = [
  'border-l-blue-500 bg-blue-50 dark:bg-blue-950/40',
  'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
  'border-l-amber-500 bg-amber-50 dark:bg-amber-950/40',
  'border-l-violet-500 bg-violet-50 dark:bg-violet-950/40',
  'border-l-rose-500 bg-rose-50 dark:bg-rose-950/40',
  'border-l-cyan-500 bg-cyan-50 dark:bg-cyan-950/40',
  'border-l-orange-500 bg-orange-50 dark:bg-orange-950/40',
  'border-l-teal-500 bg-teal-50 dark:bg-teal-950/40'
];

/** A stable colour per subject, so DBMS is the same colour every day. */
export function useSubjectColours(slots: TimetableSlot[]): (code: string) => string {
  return useMemo(() => {
    const codes = [...new Set(slots.map((s) => s.courseCode))].sort();
    return (code: string) => COLOURS[Math.max(0, codes.indexOf(code)) % COLOURS.length]!;
  }, [slots]);
}

/** "HH:MM" of the current minute, refreshed every 30 seconds. */
export function useNow(): string {
  const [now, setNow] = useState(() => new Date().toTimeString().slice(0, 5));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toTimeString().slice(0, 5)), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export const todayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! >= 12 ? 'PM' : 'AM'}`;
};
const duration = (a: string, b: string) => {
  const mins = minutes(b) - minutes(a);
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;
};

const typeIcon = (type?: string) => (/lab/i.test(type || '') ? <FlaskConical className="h-3 w-3" /> : null);

/**
 * One day, period by period — the "Today's timetable" view of CampX-style
 * student apps. Gaps between classes are shown as Break / Lunch so the day
 * reads as the student lives it.
 */
export function DaySchedule({ slots, day, isToday, date, marks }: {
  slots: TimetableSlot[];
  day: string;
  isToday: boolean;
  /** The calendar date shown (YYYY-MM-DD). With `marks`, each held class shows the student's attendance. */
  date?: string;
  marks?: AttendanceMark[];
}) {
  const now = useNow();
  const today = ymd(new Date());
  const colour = useSubjectColours(slots);
  const classes = slots
    .filter((s) => s.day.toLowerCase() === day.toLowerCase())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (classes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">No classes on {day}</p>
        <p className="text-sm text-muted-foreground">{day === 'Sunday' ? 'Holiday.' : 'Nothing is scheduled for your class this day.'}</p>
      </div>
    );
  }

  const rows: Array<{ kind: 'class'; slot: TimetableSlot; period: number } | { kind: 'break'; start: string; end: string }> = [];
  classes.forEach((slot, i) => {
    const prev = classes[i - 1];
    if (prev && minutes(slot.startTime) > minutes(prev.endTime)) rows.push({ kind: 'break', start: prev.endTime, end: slot.startTime });
    rows.push({ kind: 'class', slot, period: i + 1 });
  });

  const upNext = isToday ? classes.find((c) => c.startTime > now) : undefined;

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        if (row.kind === 'break') {
          const lunch = minutes(row.end) - minutes(row.start) >= 30;
          const live = isToday && row.start <= now && now < row.end;
          return (
            <div key={`break-${row.start}`} className={cn('flex items-center gap-3 rounded-md px-3 py-1.5 text-xs text-muted-foreground', live && 'bg-muted')}>
              <span className="w-20 shrink-0 text-right tabular-nums">{to12h(row.start)}</span>
              {lunch ? <UtensilsCrossed className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
              <span>{lunch ? 'Lunch break' : 'Short break'} · {duration(row.start, row.end)}</span>
              {live && <Badge variant="secondary" className="ml-auto text-[10px]">Now</Badge>}
            </div>
          );
        }
        const { slot, period } = row;
        const done = isToday && slot.endTime <= now;
        const live = isToday && slot.startTime <= now && now < slot.endTime;
        const next = isToday && slot === upNext;
        const mark = date && marks ? markFor(marks, slot, date) : undefined;
        const held = !!date && (date < today || (date === today && slot.startTime <= now));
        return (
          <div key={`${slot.courseCode}-${slot.startTime}`} className="flex gap-3">
            <div className="w-20 shrink-0 pt-2 text-right">
              <p className="text-sm font-semibold tabular-nums">{to12h(slot.startTime)}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">{to12h(slot.endTime)}</p>
            </div>
            <div className={cn('flex-1 rounded-lg border border-l-4 p-3', colour(slot.courseCode), live && 'ring-2 ring-primary', done && !mark && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {/lab/i.test(slot.type || '') ? 'Lab session' : `Period ${period}`} · {duration(slot.startTime, slot.endTime)}
                  </p>
                  <p className="truncate font-semibold">{slot.courseName}</p>
                  <p className="text-xs text-muted-foreground">{slot.courseCode}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {live && <Badge className="text-[10px]">Ongoing</Badge>}
                  {next && <Badge variant="secondary" className="text-[10px]">Up next</Badge>}
                  {done && <Badge variant="outline" className="text-[10px]">Completed</Badge>}
                  <Badge variant="outline" className="gap-1 text-[10px]">{typeIcon(slot.type)}{slot.type || 'Lecture'}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {slot.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.room}</span>}
                {slot.faculty && <span className="flex items-center gap-1"><User className="h-3 w-3" />{slot.faculty}</span>}
              </div>
              {marks && held && <AttendanceLine mark={mark} faculty={slot.faculty} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The student's own attendance for one held class. */
function AttendanceLine({ mark, faculty }: { mark?: AttendanceMark; faculty?: string }) {
  if (!mark) {
    return (
      <p className="mt-2 flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
        <Hourglass className="h-3.5 w-3.5" />Attendance not posted yet
      </p>
    );
  }
  if (mark.status === 'present' || mark.status === 'late') {
    return (
      <p className="mt-2 flex items-center gap-1.5 border-t pt-2 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />Marked present{mark.status === 'late' ? ' (late)' : ''}
      </p>
    );
  }
  return (
    <div className="mt-2 border-t pt-2 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
        <XCircle className="h-3.5 w-3.5" />{mark.status === 'absent' ? 'Marked absent' : 'Not on the attendance list'}
      </p>
      <p className="mt-0.5 text-muted-foreground">If you attended this class, speak to {faculty || 'your teacher'} so they can correct it.</p>
    </div>
  );
}

/** Monday–Saturday of one week, by date, with a red dot on days you were marked absent. */
export function WeekDatePicker({ dates, value, onChange, slots, marks }: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  slots: TimetableSlot[];
  marks: AttendanceMark[];
}) {
  const today = ymd(new Date());
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {dates.map((d) => {
        const weekday = weekdayOf(d);
        const count = slots.filter((x) => x.day === weekday).length;
        const absent = marks.filter((m) => m.date === d && (m.status === 'absent' || m.status === 'not_marked')).length;
        const selected = value === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn('relative flex min-w-[64px] flex-col items-center rounded-lg border px-3 py-1.5 text-xs transition-colors', selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {absent > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" title={`Absent in ${absent} class${absent === 1 ? '' : 'es'}`} />}
            <span className="font-semibold">{weekday.slice(0, 3)} {parseYmd(d).getDate()}</span>
            <span className={cn('text-[10px]', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              {d === today ? 'Today' : `${count} class${count === 1 ? '' : 'es'}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The whole week as a grid: days down the side, time across the top. Columns
 * come from the class boundaries themselves, so a three-hour lab spans three
 * columns and breaks get their own narrow column.
 */
export function WeekGrid({ slots, dates, marks }: { slots: TimetableSlot[]; dates?: string[]; marks?: AttendanceMark[] }) {
  const colour = useSubjectColours(slots);
  const now = useNow();
  // Only highlight "today" when the week shown is this week.
  const today = !dates || dates.includes(ymd(new Date())) ? todayName() : '';

  const columns = useMemo(() => {
    const bounds = [...new Set(slots.flatMap((s) => [s.startTime, s.endTime]))].sort();
    return bounds.slice(0, -1).map((start, i) => {
      const end = bounds[i + 1]!;
      const covered = slots.some((s) => s.startTime <= start && s.endTime >= end);
      return { start, end, isBreak: !covered, lunch: !covered && minutes(end) - minutes(start) >= 30 };
    });
  }, [slots]);

  if (slots.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No timetable published for your class yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="w-24 border-b p-2 text-left font-medium">Day</th>
            {columns.map((c) => (
              <th key={c.start} className={cn('border-b border-l p-2 text-center font-medium', c.isBreak && 'w-10 bg-muted text-[10px] text-muted-foreground')}>
                {c.isBreak ? (c.lunch ? 'Lunch' : '') : <>{to12h(c.start)}<br /><span className="font-normal text-muted-foreground">{to12h(c.end)}</span></>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEK_DAYS.map((day) => {
            const cells: JSX.Element[] = [];
            for (let i = 0; i < columns.length; i++) {
              const col = columns[i]!;
              if (col.isBreak) {
                cells.push(<td key={col.start} className="border-l bg-muted/60" />);
                continue;
              }
              const slot = slots.find((s) => s.day === day && s.startTime <= col.start && s.endTime >= col.end);
              if (!slot) {
                cells.push(<td key={col.start} className="border-l p-1 text-center text-muted-foreground/50">—</td>);
                continue;
              }
              let span = 1;
              while (i + span < columns.length && columns[i + span]!.end <= slot.endTime) span++;
              const live = day === today && slot.startTime <= now && now < slot.endTime;
              const cellDate = dates?.[WEEK_DAYS.indexOf(day)];
              const mark = cellDate ? markFor(marks, slot, cellDate) : undefined;
              cells.push(
                <td key={col.start} colSpan={span} className="border-l p-1">
                  <div className={cn('h-full rounded border-l-4 p-1.5', colour(slot.courseCode), live && 'ring-2 ring-primary')} title={`${slot.courseName} · ${slot.faculty ?? ''}`}>
                    <p className="flex items-center justify-between font-semibold">
                      {slot.courseCode}
                      {mark && (mark.status === 'present' || mark.status === 'late'
                        ? <span className="rounded bg-green-600 px-1 text-[9px] text-white" title="Marked present">P</span>
                        : <span className="rounded bg-red-600 px-1 text-[9px] text-white" title="Marked absent">A</span>)}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">{slot.type === 'Lecture' ? slot.room : `${slot.type} · ${slot.room}`}</p>
                  </div>
                </td>
              );
              i += span - 1;
            }
            return (
              <tr key={day} className={cn('border-b last:border-0', day === today && 'bg-primary/5')}>
                <td className="p-2 font-medium">{day.slice(0, 3)}{day === today && <span className="ml-1 text-[10px] text-primary">Today</span>}</td>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Subject key under the week grid. */
export function SubjectLegend({ slots }: { slots: TimetableSlot[] }) {
  const colour = useSubjectColours(slots);
  const subjects = [...new Map(slots.map((s) => [s.courseCode, s])).values()].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {subjects.map((s) => {
        const weekly = slots.filter((x) => x.courseCode === s.courseCode).reduce((sum, x) => sum + minutes(x.endTime) - minutes(x.startTime), 0);
        return (
          <div key={s.courseCode} className={cn('rounded-md border border-l-4 p-2 text-xs', colour(s.courseCode))}>
            <p className="font-semibold">{s.courseCode} · {s.courseName}</p>
            <p className="flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" />{s.faculty || 'TBA'}</p>
            <p className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{(weekly / 60).toFixed(1).replace('.0', '')} hrs / week</p>
          </div>
        );
      })}
    </div>
  );
}
