import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchApi } from '@/lib/apiService';

/**
 * Printable documents on the college letterhead. Opened in a new tab; the
 * browser's print dialog saves them as PDF.
 *
 *   /print/hall-ticket/:sessionId    /print/marks-memo/:semester
 *   /print/transcript                /print/certificate/:id
 *   /print/fee-receipt/:id           /print/payslip/:id
 */
const SOURCE: Record<string, (id?: string) => string> = {
  'hall-ticket': (id) => `/students/hall-tickets/${id}`,
  'marks-memo': () => '/students/results/transcript',
  transcript: () => '/students/results/transcript',
  certificate: (id) => `/students/certificates/${id}/document`,
  'fee-receipt': (id) => `/students/fees/${id}/receipt`,
  payslip: (id) => `/account/payslips/${id}`
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: unknown) => (d ? new Date(String(d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const CERT_TITLE: Record<string, string> = {
  bonafide: 'Bonafide Certificate', character: 'Conduct Certificate', transfer: 'Transfer Certificate',
  migration: 'Migration Certificate', provisional: 'Provisional Certificate', degree: 'Degree Certificate', transcript: 'Transcript'
};

function Letterhead({ inst, title }: { inst: any; title: string }) {
  return (
    <div className="mb-6 border-b-2 border-black pb-3 text-center">
      <h1 className="text-2xl font-bold uppercase tracking-wide">{inst?.name ?? 'Institution'}</h1>
      {inst?.address && <p className="text-sm">{inst.address}</p>}
      <p className="text-xs">{[inst?.phone, inst?.email, inst?.website].filter(Boolean).join(' · ')}{inst?.naacGrade ? ` · NAAC ${inst.naacGrade}` : ''}</p>
      <h2 className="mt-3 text-lg font-semibold underline underline-offset-4">{title}</h2>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <tr><td className="w-48 py-1 pr-4 align-top font-medium">{k}</td><td className="py-1">{v}</td></tr>
);

function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-16 flex justify-between text-sm">
      <div className="text-center"><div className="mb-1 h-10" /><p className="border-t border-black px-6 pt-1">{left}</p></div>
      <div className="text-center"><div className="mb-1 h-10" /><p className="border-t border-black px-6 pt-1">{right}</p></div>
    </div>
  );
}

export default function PrintDocument() {
  const { kind = '', id } = useParams();
  // Finance prints any employee's payslip; staff print only their own.
  const [search] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const src = SOURCE[kind];
    if (!src) { setError('Unknown document.'); return; }
    const url = kind === 'payslip' && search.get('as') === 'finance' ? `/finance/payslips/${id}` : src(id);
    fetchApi<any>(url).then(setData).catch((e) => setError(e?.message || 'Could not load the document.'));
  }, [kind, id]);

  useEffect(() => {
    if (!data) return;
    document.title = `${kind}-${id ?? ''}`.replace(/-$/, '');
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [data]);

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (!data) return <div className="p-10 text-center text-gray-500">Preparing the document…</div>;

  let body: React.ReactNode = null;
  if (kind === 'hall-ticket') {
    body = (
      <>
        <Letterhead inst={data.institution} title={`Hall Ticket — ${data.session.name}`} />
        <table className="mb-4 text-sm"><tbody>
          <Row k="Hall ticket no." v={data.ticketNumber} />
          <Row k="Name" v={data.student.name} />
          <Row k="Roll number" v={data.student.rollNumber} />
          <Row k="Programme" v={`${data.student.program ?? ''} ${data.student.branch ?? ''}`} />
          <Row k="Semester / year" v={`${data.session.semester} · ${data.session.academicYear}`} />
          <Row k="Verification code" v={<span className="font-mono">{data.verificationCode}</span>} />
        </tbody></table>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-gray-100">{['Date', 'Time', 'Course', 'Venue', 'Invigilator'].map((h) => <th key={h} className="border border-black p-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{data.papers.map((p: any) => (
            <tr key={p.courseCode}><td className="border border-black p-2">{date(p.examDate)}</td><td className="border border-black p-2">{p.startTime}–{p.endTime}</td><td className="border border-black p-2">{p.courseCode} — {p.courseName}</td><td className="border border-black p-2">{p.venue ?? '—'}</td><td className="border border-black p-2" /></tr>
          ))}</tbody>
        </table>
        <ul className="mt-4 list-disc pl-6 text-xs">
          <li>Carry this hall ticket and your college ID card to every examination.</li>
          <li>Report to the hall 30 minutes before the start. No entry after 30 minutes.</li>
          <li>Mobile phones and electronic devices are not permitted in the hall.</li>
        </ul>
        <Signatures left="Candidate's signature" right="Controller of Examinations" />
      </>
    );
  } else if (kind === 'marks-memo' || kind === 'transcript') {
    const sem = kind === 'marks-memo' ? Number(id) : null;
    const semesters = (data.semesters ?? []).filter((s: any) => sem === null || s.semester === sem);
    const recordsOf = (n: number) => (data.records ?? []).filter((r: any) => r.semester === n);
    if (!data.official || !semesters.length) {
      body = <><Letterhead inst={data.institution} title={kind === 'transcript' ? 'Transcript' : 'Marks Memo'} /><p className="text-center">No published results{sem ? ` for semester ${sem}` : ''} yet.</p></>;
    } else {
      body = (
        <>
          <Letterhead inst={data.institution} title={kind === 'transcript' ? 'Consolidated Transcript' : `Memorandum of Marks — Semester ${sem}`} />
          <table className="mb-4 text-sm"><tbody>
            <Row k="Name" v={data.student.name} /><Row k="Roll number" v={data.student.rollNumber} />
            <Row k="Programme" v={`${data.student.program ?? ''} ${data.student.branch ?? ''}`} /><Row k="Admitted" v={data.student.admissionYear} />
          </tbody></table>
          {semesters.map((s: any) => (
            <div key={s.semester} className="mb-5 break-inside-avoid">
              <p className="mb-1 font-semibold">Semester {s.semester} · {s.academicYear}</p>
              <table className="w-full border-collapse text-sm">
                <thead><tr className="bg-gray-100">{['Code', 'Course', 'Credits', ...(kind === 'marks-memo' ? ['Internal', 'External'] : []), 'Total', 'Grade', 'Result'].map((h) => <th key={h} className="border border-black p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{recordsOf(s.semester).map((r: any) => (
                  <tr key={r.courseCode}>
                    <td className="border border-black p-1.5">{r.courseCode}</td><td className="border border-black p-1.5">{r.courseName}</td><td className="border border-black p-1.5">{r.credits}</td>
                    {kind === 'marks-memo' && <><td className="border border-black p-1.5">{r.internalMarks ?? '—'}</td><td className="border border-black p-1.5">{r.externalMarks ?? '—'}</td></>}
                    <td className="border border-black p-1.5">{r.totalMarks ?? '—'}/{r.maxMarks ?? 100}</td><td className="border border-black p-1.5 font-semibold">{r.letterGrade}</td><td className="border border-black p-1.5">{r.isPassing ? 'Pass' : 'Fail'}{r.attempt > 1 ? ` (attempt ${r.attempt})` : ''}</td>
                  </tr>
                ))}</tbody>
              </table>
              <p className="mt-1 text-sm">SGPA <b>{Number(s.sgpa).toFixed(2)}</b> · CGPA <b>{Number(s.cgpa).toFixed(2)}</b> · Credits earned {s.creditsEarned}/{s.creditsRegistered}</p>
            </div>
          ))}
          <p className="text-xs">Generated on {date(data.generatedAt)}. Grades are as published by the Controller of Examinations; revalued attempts supersede the original.</p>
          <Signatures left="Verified by" right="Controller of Examinations" />
        </>
      );
    }
  } else if (kind === 'certificate') {
    const s = data.student;
    const pron = /female/i.test(String(s.gender)) ? ['she', 'her', 'Ms.', 'daughter'] : /male/i.test(String(s.gender)) ? ['he', 'his', 'Mr.', 'son'] : ['they', 'their', '', 'ward'];
    body = (
      <>
        <Letterhead inst={data.institution} title={CERT_TITLE[data.certificate.type] ?? 'Certificate'} />
        <div className="mb-6 flex justify-between text-sm"><span>No. <b>{data.certificate.number}</b></span><span>Date: {date(data.certificate.issuedAt)}</span></div>
        <p className="text-justify leading-8">
          This is to certify that {pron[2]} <b>{s.name}</b>{s.fatherName ? <>, {pron[3]} of <b>{s.fatherName}</b>,</> : ''} bearing roll number <b>{s.rollNumber}</b>, is a bonafide student of this institution,
          studying in semester {s.semester} of <b>{s.program} {s.branch}</b> ({s.department}) during the academic year {data.academicYear ?? '—'}.
          {s.dateOfBirth ? <> {pron[1][0]!.toUpperCase() + pron[1].slice(1)} date of birth as per our records is {date(s.dateOfBirth)}.</> : null}
          {' '}To the best of our knowledge {pron[0]} bears a good character.
        </p>
        <p className="mt-4">This certificate is issued for the purpose of <b>{data.certificate.purpose || 'general use'}</b>.</p>
        <p className="mt-4 text-xs">Verify this certificate with the Registrar's office quoting number {data.certificate.number}.</p>
        <Signatures left="Office seal" right="Registrar" />
      </>
    );
  } else if (kind === 'fee-receipt') {
    const r = data.receipt;
    body = (
      <>
        <Letterhead inst={data.institution} title="Fee Receipt" />
        <div className="mb-4 flex justify-between text-sm"><span>Receipt no. <b>{r.number}</b></span><span>Date: {date(r.date)}</span></div>
        <table className="mb-4 text-sm"><tbody>
          <Row k="Received from" v={`${data.student.name} (${data.student.rollNumber})`} />
          <Row k="Programme" v={`${data.student.program ?? ''} ${data.student.branch ?? ''}, semester ${data.student.semester}`} />
          <Row k="Academic year" v={r.academicYear} />
        </tbody></table>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-gray-100"><th className="border border-black p-2 text-left">Particulars</th><th className="border border-black p-2 text-right">Amount</th></tr></thead>
          <tbody>
            <tr><td className="border border-black p-2">{r.description}</td><td className="border border-black p-2 text-right">{inr(r.amount)}</td></tr>
            {r.waived > 0 && <tr><td className="border border-black p-2">Less: waiver / scholarship</td><td className="border border-black p-2 text-right">− {inr(r.waived)}</td></tr>}
            <tr className="font-semibold"><td className="border border-black p-2">Amount received</td><td className="border border-black p-2 text-right">{inr(r.paid)}</td></tr>
          </tbody>
        </table>
        <p className="mt-6 text-xs">This is a computer-generated receipt.</p>
        <Signatures left="Student" right="Finance Officer" />
      </>
    );
  } else if (kind === 'payslip') {
    const p = data;
    const allowances = Array.isArray(p.allowances) ? p.allowances : [];
    const deductions = Array.isArray(p.deductions) ? p.deductions : [];
    const rows = Math.max(allowances.length + 1, deductions.length);
    body = (
      <>
        <Letterhead inst={p.institution} title={`Payslip — ${p.month} ${p.year}`} />
        <table className="mb-4 text-sm"><tbody>
          <Row k="Employee" v={`${p.employeeName} (${p.employeeId})`} /><Row k="Designation" v={p.designation} /><Row k="Department" v={p.department} />
          {p.bankAccount && <Row k="Bank account" v={`${p.bankAccount}${p.ifsc ? ` · ${p.ifsc}` : ''}`} />}{p.pan && <Row k="PAN" v={p.pan} />}
          <Row k="Paid on" v={date(p.paymentDate)} />
        </tbody></table>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-gray-100"><th className="border border-black p-2 text-left">Earnings</th><th className="border border-black p-2 text-right">Amount</th><th className="border border-black p-2 text-left">Deductions</th><th className="border border-black p-2 text-right">Amount</th></tr></thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => {
              const e = i === 0 ? { name: 'Basic pay', amount: p.basicSalary } : allowances[i - 1];
              const d = deductions[i];
              return <tr key={i}><td className="border border-black p-2">{e?.name ?? ''}</td><td className="border border-black p-2 text-right">{e ? inr(e.amount) : ''}</td><td className="border border-black p-2">{d?.name ?? ''}</td><td className="border border-black p-2 text-right">{d ? inr(d.amount) : ''}</td></tr>;
            })}
            <tr className="font-semibold"><td className="border border-black p-2">Gross earnings</td><td className="border border-black p-2 text-right">{inr(p.grossSalary)}</td><td className="border border-black p-2">Total deductions</td><td className="border border-black p-2 text-right">{inr(p.grossSalary - p.netSalary)}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-base font-semibold">Net pay: {inr(p.netSalary)}</p>
        <p className="mt-6 text-xs">This is a computer-generated payslip and needs no signature.</p>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <div className="no-print flex justify-center gap-2 border-b bg-gray-50 p-3">
        <button className="rounded bg-black px-4 py-1.5 text-sm text-white" onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="rounded border px-4 py-1.5 text-sm" onClick={() => window.close()}>Close</button>
      </div>
      <div className="mx-auto max-w-[800px] p-8 font-serif">{body}</div>
    </div>
  );
}
