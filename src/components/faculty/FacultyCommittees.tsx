import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, FileText, Users, ChevronRight, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';

export default function FacultyCommittees() {
  const [committees, setCommittees] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/faculty/committees').then(d => setCommittees(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Committees & Collaboration</h1>

        <div className="grid gap-4 md:grid-cols-2">
          {committees.map((com) => (
            <Card key={com.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{com.name}</CardTitle>
                  <Badge>{com.role}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Tenure: {com.tenure}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Meetings Attended</span>
                  <span className="font-medium">{com.meetingsAttended}/{com.totalMeetings}</span>
                </div>
                {com.nextMeeting && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-2 text-sm">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Next Meeting:</span>
                    <span className="font-medium text-foreground">{com.nextMeeting}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Documents</p>
                  {com.documents.map((doc) => (
                    <div key={doc} className="flex items-center justify-between rounded border border-border p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc}
                      </div>
                      <Button variant="ghost" size="sm"><Download className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
