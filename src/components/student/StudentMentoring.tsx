import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, User, Calendar, BookOpen } from 'lucide-react';
import { fetchApi } from '@/lib/apiService';

export default function StudentMentoring() {
  const [data, setData] = useState<any>({ mentor: null, counselingNotes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/students/mentoring')
      .then((response) => {
        setData({
          mentor: response?.mentor || null,
          counselingNotes: Array.isArray(response?.counselingNotes) ? response.counselingNotes : []
        });
      })
      .catch((error) => {
        console.error('API request failed', error);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mentoring</h1>
          <p className="text-muted-foreground">View your assigned mentor, counseling notes, and mentor messages.</p>
        </div>

        {!data.mentor ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No mentor assigned yet</p>
              <p className="text-sm text-muted-foreground">Please contact your department office for mentor allocation.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assigned Mentor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xl font-semibold text-foreground">{data.mentor.name}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{data.mentor.email}</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" />{data.mentor.specialization || 'General Mentoring'}</span>
                  {data.mentor.lastMeetingDate ? (
                    <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />Last meeting: {new Date(data.mentor.lastMeetingDate).toLocaleDateString('en-IN')}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {data.counselingNotes.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">No counseling notes available yet.</CardContent></Card>
              ) : (
                data.counselingNotes.map((note: any) => (
                  <Card key={note.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{note.topic}</Badge>
                          <Badge variant={note.status === 'open' ? 'secondary' : 'default'} className="capitalize">{note.status}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(note.date).toLocaleDateString('en-IN')}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{note.notes}</p>
                      {note.followUpDate ? (
                        <p className="mt-2 text-xs text-amber-600">Follow up: {new Date(note.followUpDate).toLocaleDateString('en-IN')}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {loading ? <p className="text-sm text-muted-foreground">Loading mentoring data...</p> : null}
      </div>
    </DashboardLayout>
  );
}
