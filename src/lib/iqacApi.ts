import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';
import type { CriteriaProgress, FeedbackSummary, IQACActionItem, IQACMeeting, QualityDocument } from '@/types/iqac';

const CATEGORY_ORDER = ['naac', 'nirf', 'internal'];
const CATEGORY_TITLES: Record<string, string> = {
  naac: 'NAAC Metrics',
  nirf: 'NIRF Metrics',
  internal: 'Internal Quality Metrics'
};

function metricProgress(metric: any): number {
  const current = Number(metric?.currentValue);
  const target = Number(metric?.target);
  if (Number.isFinite(current) && Number.isFinite(target) && target > 0) {
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  }

  const status = safeString(metric?.status).toLowerCase();
  if (status === 'on_track') return 85;
  if (status === 'at_risk') return 45;
  if (status === 'delayed') return 30;
  return 60;
}

function criterionStatus(progress: number, hasRisk: boolean): CriteriaProgress['status'] {
  if (hasRisk) return 'needs_attention';
  if (progress >= 95) return 'completed';
  return 'in_progress';
}

export async function fetchIQACCriteriaProgress(): Promise<CriteriaProgress[]> {
  const [groupedMetrics, documents] = await Promise.all([
    fetchApi<Record<string, any[]>>('/iqac/criteria'),
    fetchApi<any[]>('/iqac/documents')
  ]);

  const docs = safeArray<any>(documents);
  const categories = Object.keys(groupedMetrics || {});
  categories.sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a);
    const bIndex = CATEGORY_ORDER.indexOf(b);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });

  return categories.map((category, index) => {
    const metrics = safeArray<any>(groupedMetrics?.[category]);
    const criteriaNumber = index + 1;
    const docsForCriterion = docs.filter((doc) => safeNumber(doc?.criteriaNumber, -1) === criteriaNumber);

    const progressValues = metrics.map(metricProgress);
    const progress = progressValues.length > 0
      ? Math.round(progressValues.reduce((acc, value) => acc + value, 0) / progressValues.length)
      : 0;

    const issues = metrics
      .filter((metric) => safeString(metric?.status).toLowerCase() === 'at_risk')
      .map((metric) => `${safeString(metric?.metric, 'Metric')} is at risk (current ${safeString(metric?.currentValue, 'N/A')}, target ${safeString(metric?.target, 'N/A')})`);

    return {
      criteriaNumber,
      title: CATEGORY_TITLES[category] || `${category.toUpperCase()} Metrics`,
      dataProgress: progress,
      documentsUploaded: docsForCriterion.length,
      requiredDocuments: Math.max(docsForCriterion.length, metrics.length * 2, 1),
      status: criterionStatus(progress, issues.length > 0),
      lastUpdated: new Date(),
      issues
    };
  });
}

export async function fetchIQACActions(): Promise<IQACActionItem[]> {
  const actions = await fetchApi<any[]>('/iqac/actions');
  return safeArray<any>(actions).map((item) => ({
    ...item,
    dueDate: safeDate(item?.dueDate),
    createdDate: safeDate(item?.createdDate),
    completedDate: item?.completedDate ? safeDate(item.completedDate) : undefined,
    evidence: safeArray<string>(item?.evidence)
  }));
}

export async function createIQACAction(payload: {
  title: string;
  description: string;
  category: string;
  priority?: string;
  assignedTo: string;
  department?: string;
  dueDate: string;
  implementationStatus?: string;
  impact?: string;
}) {
  return postApi('/iqac/actions', payload);
}

export async function updateIQACAction(id: string, payload: Record<string, unknown>) {
  return putApi(`/iqac/actions/${id}`, payload);
}

export async function fetchIQACDocuments(): Promise<QualityDocument[]> {
  const docs = await fetchApi<any[]>('/iqac/documents');
  return safeArray<any>(docs).map((item) => ({
    ...item,
    uploadDate: safeDate(item?.uploadDate),
    reviewDate: item?.reviewDate ? safeDate(item.reviewDate) : undefined,
    tags: safeArray<string>(item?.tags)
  }));
}

export async function updateIQACDocument(id: string, payload: Record<string, unknown>) {
  return putApi(`/iqac/documents/${id}`, payload);
}

export async function fetchIQACFeedbackSummaries(): Promise<FeedbackSummary[]> {
  const forms = await fetchApi<any[]>('/iqac/feedback');
  return safeArray<any>(forms).map((item) => ({
    type: safeString(item?.type || item?.targetAudience || 'student') as FeedbackSummary['type'],
    respondents: safeNumber(item?.respondents ?? item?.totalResponses),
    averageRating: safeNumber(item?.averageRating, 0),
    satisfactionLevel: (safeString(item?.satisfactionLevel || 'satisfactory') as FeedbackSummary['satisfactionLevel']),
    keyFindings: safeArray<string>(item?.keyFindings),
    improvementAreas: safeArray<string>(item?.improvementAreas),
    lastCollected: safeDate(item?.lastCollected || item?.createdAt)
  }));
}

export async function createIQACFeedbackForm(payload: {
  title: string;
  deadline: string;
  courseId?: string;
  status?: string;
}) {
  return postApi('/iqac/feedback/create-form', payload);
}

export async function fetchIQACMeetings(): Promise<IQACMeeting[]> {
  const meetings = await fetchApi<any[]>('/iqac/meetings');
  return safeArray<any>(meetings).map((meeting) => ({
    ...meeting,
    date: safeDate(meeting?.date),
    nextMeetingDate: meeting?.nextMeetingDate ? safeDate(meeting.nextMeetingDate) : undefined,
    agenda: safeArray<string>(meeting?.agenda),
    attendees: safeArray<any>(meeting?.attendees).map((attendee) => {
      if (typeof attendee === 'string') {
        return {
          name: attendee,
          designation: 'Member',
          attended: false,
          role: 'member'
        };
      }
      return {
        name: safeString(attendee?.name, 'Member'),
        designation: safeString(attendee?.designation, 'Member'),
        attended: Boolean(attendee?.attended),
        role: safeString(attendee?.role, 'member')
      };
    }),
    decisions: safeArray<string>(meeting?.decisions),
    actionItems: safeArray<string>(meeting?.actionItems),
    documentsShared: safeArray<string>(meeting?.documentsShared)
  }));
}

export async function createIQACMeeting(payload: {
  title: string;
  date: string;
  venue: string;
  agenda?: string[];
}) {
  return postApi('/iqac/meetings', payload);
}

export async function updateIQACMeeting(id: string, payload: Record<string, unknown>) {
  return putApi(`/iqac/meetings/${id}`, payload);
}

export async function fetchAQARReports() {
  return fetchApi<any[]>('/iqac/reports');
}

export async function generateAQAR(academicYear: string) {
  return postApi('/iqac/reports/generate', { academicYear });
}

export async function updateAQAR(id: string, payload: Record<string, unknown>) {
  return putApi(`/iqac/reports/${id}`, payload);
}
