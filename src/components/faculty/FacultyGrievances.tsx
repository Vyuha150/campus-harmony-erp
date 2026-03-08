import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Star, MessageSquare, AlertTriangle, ThumbsUp, TrendingUp
} from 'lucide-react';
import { feedbackSummaries, facultyGrievances } from '@/data/facultyMockData';
import { useToast } from '@/hooks/use-toast';

export default function FacultyGrievancesFeedback() {
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Grievances & Feedback</h1>

        <Tabs defaultValue="feedback" className="space-y-4">
          <TabsList>
            <TabsTrigger value="feedback">Student Feedback</TabsTrigger>
            <TabsTrigger value="grievances">Grievances</TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="space-y-4">
            {feedbackSummaries.map((fb) => (
              <Card key={fb.courseId} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{fb.courseCode} – {fb.courseName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{fb.semester} • {fb.totalResponses} responses</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      <span className="text-2xl font-bold text-foreground">{fb.overallRating}</span>
                      <span className="text-sm text-muted-foreground">/ {fb.maxRating}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {fb.categories.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="w-40 text-sm text-muted-foreground">{cat.name}</span>
                        <Progress value={(cat.score / cat.maxScore) * 100} className="h-2 flex-1" />
                        <span className="w-12 text-right text-sm font-medium">{cat.score}/{cat.maxScore}</span>
                      </div>
                    ))}
                  </div>
                  {fb.suggestions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Student Suggestions</p>
                      <div className="space-y-1">
                        {fb.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="grievances" className="space-y-3">
            {facultyGrievances.map((g) => (
              <Card key={g.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={g.type === 'assigned_review' ? 'secondary' : 'outline'} className="capitalize text-[10px]">
                          {g.type.replace('_', ' ')}
                        </Badge>
                        <Badge variant={g.status === 'new' ? 'destructive' : g.status === 'under_review' ? 'secondary' : 'default'} className="capitalize">
                          {g.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-foreground">{g.subject}</h3>
                      <p className="text-sm text-muted-foreground">{g.description}</p>
                      <p className="text-xs text-muted-foreground">Filed by: {g.filedBy} • {g.filedAt}</p>
                    </div>
                  </div>
                  {g.response && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Response</p>
                      <p className="text-sm">{g.response}</p>
                    </div>
                  )}
                  {g.status === 'under_review' && (
                    <div className="mt-3 space-y-2">
                      <Textarea placeholder="Enter your response..." />
                      <Button size="sm" onClick={() => toast({ title: 'Response Submitted' })}>Submit Response</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
