import { useEffect, useState } from 'react';
import { CalendarDays, CalendarSearch, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchApi } from '@/lib/apiService';
import { DaySchedule, SubjectLegend, WeekDatePicker, WeekGrid, parseYmd, shiftDays, useAttendanceMarks, weekOf, weekdayOf, ymd, type TimetableSlot } from './Timetable';

/**
 * Jump to any date. The month shown marks each day with the student's
 * attendance — red where they were marked absent in any class, green where
 * every class held was present — so a wrong mark is easy to find.
 */
function DateJump({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseYmd(value));
  useEffect(() => { setMonth(parseYmd(value)); }, [value]);
  const first = ymd(new Date(month.getFullYear(), month.getMonth(), 1));
  const last = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const marks = useAttendanceMarks(first, last);

  const byDay = new Map<string, { absent: number; present: number }>();
  for (const m of marks) {
    const entry = byDay.get(m.date) ?? { absent: 0, present: 0 };
    if (m.status === 'present' || m.status === 'late') entry.present++; else entry.absent++;
    byDay.set(m.date, entry);
  }
  const absentDays = [...byDay].filter(([, v]) => v.absent > 0).map(([d]) => parseYmd(d));
  const presentDays = [...byDay].filter(([, v]) => v.absent === 0 && v.present > 0).map(([d]) => parseYmd(d));
  const absences = [...byDay.values()].reduce((sum, v) => sum + v.absent, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1"><CalendarSearch className="h-4 w-4" />Pick a date</Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={parseYmd(value)}
          month={month}
          onMonthChange={setMonth}
          onSelect={(d) => { if (d) { onChange(ymd(d)); setOpen(false); } }}
          disabled={{ dayOfWeek: [0] }}
          modifiers={{ absent: absentDays, allPresent: presentDays }}
          modifiersClassNames={{
            absent: 'bg-red-100 text-red-700 font-semibold dark:bg-red-950 dark:text-red-300',
            allPresent: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
          }}
        />
        <div className="space-y-1 border-t p-3 text-xs">
          <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-green-200 dark:bg-green-900" />Present in every class</p>
          <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-red-200 dark:bg-red-900" />Absent in at least one class</p>
          <p className="text-muted-foreground">{absences === 0 ? 'No absences this month.' : `${absences} absent class${absences === 1 ? '' : 'es'} this month.`}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The student's class timetable: today period by period, and the whole week. */
export default function StudentTimetable() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = ymd(new Date());
  // Sunday has no classes: open on Saturday's, the most recent day with marks.
  const [date, setDate] = useState(weekdayOf(today) === 'Sunday' ? shiftDays(today, -1) : today);
  const week = weekOf(date);
  const marks = useAttendanceMarks(week[0]!, week[5]!);
  const day = weekdayOf(date);
  const weekLabel = `${parseYmd(week[0]!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${parseYmd(week[5]!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const weekNav = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(shiftDays(date, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-sm font-medium">{weekLabel}</span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(shiftDays(date, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
      <DateJump value={date} onChange={setDate} />
      <Button variant="ghost" size="sm" onClick={() => setDate(today)} disabled={date === today}>Today</Button>
    </div>
  );

  useEffect(() => {
    fetchApi<TimetableSlot[]>('/students/timetable')
      .then((rows) => setSlots(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err?.message || 'Unable to load your timetable.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Class Timetable</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        <Tabs defaultValue="day">
          <TabsList>
            <TabsTrigger value="day" className="gap-1"><CalendarDays className="h-4 w-4" />Day view</TabsTrigger>
            <TabsTrigger value="week" className="gap-1"><LayoutGrid className="h-4 w-4" />Week view</TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="space-y-4">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{date === today ? "Today's classes" : `${day}, ${parseYmd(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`}</CardTitle>
                    <CardDescription>Hour by hour, with your attendance for each class held.</CardDescription>
                  </div>
                  {weekNav}
                </div>
                <WeekDatePicker dates={week} value={date} onChange={setDate} slots={slots} marks={marks} />
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-sm text-muted-foreground">Loading timetable…</p> : <DaySchedule slots={slots} day={day} isToday={date === today} date={date} marks={marks} />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="week" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>Weekly timetable</CardTitle>
                    <CardDescription>P / A shows your attendance for classes already held. Labs span their full block.</CardDescription>
                  </div>
                  {weekNav}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? <p className="text-sm text-muted-foreground">Loading timetable…</p> : <WeekGrid slots={slots} dates={week} marks={marks} />}
                <SubjectLegend slots={slots} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
