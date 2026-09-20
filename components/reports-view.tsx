'use client';

import { useMemo, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Bars({ rows }: { rows: [string, number, string][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="bars">
      {rows.map(([label, value, color]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(value / max) * 100}%`, background: color }} /></div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
const monthStart = () => today().slice(0, 8) + '01';

export default function ReportsView({ classes, sections, exams }: { classes: any[]; sections: any[]; exams: any[] }) {
  const [tab, setTab] = useState<'attendance' | 'submission' | 'results'>('attendance');
  return (
    <>
      <div className="row-actions" style={{ marginBottom: 14 }}>
        <button className={tab === 'attendance' ? 'primary-btn' : 'secondary-btn'} onClick={() => setTab('attendance')}>Attendance</button>
        <button className={tab === 'submission' ? 'primary-btn' : 'secondary-btn'} onClick={() => setTab('submission')}>Marks submission</button>
        <button className={tab === 'results' ? 'primary-btn' : 'secondary-btn'} onClick={() => setTab('results')}>Results</button>
      </div>
      {tab === 'attendance' && <AttendanceReport classes={classes} sections={sections} />}
      {tab === 'submission' && <SubmissionReport exams={exams} />}
      {tab === 'results' && <ResultsReport exams={exams} />}
    </>
  );
}

/* ---------------------------------------------------------------- attendance */
function AttendanceReport({ classes, sections }: { classes: any[]; sections: any[] }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const classSections = sections.filter((s) => s.class_id === classId);

  async function run() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('report_attendance_summary', {
      p_from: from,
      p_to: to,
      p_class_id: classId || null,
      p_section_id: sectionId || null,
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setRows(data || []);
  }

  const totals = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const r of rows || []) {
      t.present += Number(r.present_days); t.absent += Number(r.absent_days);
      t.late += Number(r.late_days); t.excused += Number(r.excused_days); t.total += Number(r.total_days);
    }
    return t;
  }, [rows]);

  const bySection = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of rows || []) {
      const key = `${r.class_id}:${r.section_id}`;
      const g = map.get(key) || { label: `${r.class_name} · ${r.section_name}`, students: 0, attended: 0, total: 0 };
      g.students += 1; g.attended += Number(r.present_days) + Number(r.late_days); g.total += Number(r.total_days);
      map.set(key, g);
    }
    return [...map.values()];
  }, [rows]);

  return (
    <section className="panel">
      <div className="panel-head"><div><h3>Attendance report</h3><p>Attendance % counts Present and Late as attended.</p></div></div>
      <div className="form-grid five">
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Class
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Section
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
            <option value="">All sections</option>
            {classSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <div className="row-actions" style={{ margin: '10px 0' }}>
        <button className="primary-btn" onClick={run} disabled={busy}><Play size={15} /> {busy ? 'Loading…' : 'Show report'}</button>
        <button className="secondary-btn" disabled={!rows?.length} onClick={() =>
          downloadCsv(`attendance_${from}_to_${to}.csv`, [
            ['Class', 'Section', 'Student', 'Present', 'Absent', 'Late', 'Excused', 'Total days', 'Attendance %'],
            ...(rows || []).map((r) => [r.class_name, r.section_name, r.student_name, r.present_days, r.absent_days, r.late_days, r.excused_days, r.total_days, r.percentage]),
          ])}><Download size={15} /> CSV</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {rows && rows.length === 0 && <div className="loading-row">No attendance was recorded in this period.</div>}
      {rows && rows.length > 0 && (
        <>
          <Bars rows={[['Present', totals.present, '#2ea86b'], ['Late', totals.late, '#e6a23c'], ['Absent', totals.absent, '#e0566f'], ['Excused', totals.excused, '#7b8bb0']]} />
          <h4 style={{ margin: '18px 0 8px' }}>By class and section</h4>
          <div className="audit-list">
            {bySection.map((g) => (
              <div className="audit-row" key={g.label} style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
                <strong>{g.label}</strong>
                <span>{g.students} students</span>
                <strong>{g.total ? Math.round((g.attended / g.total) * 1000) / 10 : 0}%</strong>
              </div>
            ))}
          </div>
          <h4 style={{ margin: '18px 0 8px' }}>Students (lowest attendance first)</h4>
          <div className="audit-list">
            {[...rows].sort((a, b) => Number(a.percentage) - Number(b.percentage)).slice(0, 200).map((r) => (
              <div className="audit-row" key={r.student_id} style={{ gridTemplateColumns: '1.4fr 1fr 2fr auto' }}>
                <strong>{r.student_name}</strong>
                <span>{r.class_name} · {r.section_name}</span>
                <span>P {r.present_days} · A {r.absent_days} · L {r.late_days} · E {r.excused_days}</span>
                <strong style={{ color: Number(r.percentage) < 75 ? '#c13f52' : undefined }}>{r.percentage}%</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- marks submission */
function SubmissionReport({ exams }: { exams: any[] }) {
  const [examId, setExamId] = useState(exams[0]?.id || '');
  const [sheets, setSheets] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    const supabase = createClient();
    if (!supabase || !examId) return;
    setBusy(true); setError('');
    const { data, error: loadError } = await supabase
      .from('exam_mark_sheets')
      .select('id,status,submitted_at,verified_at,classes(name,grade),sections(name),subjects(name),profiles!exam_mark_sheets_teacher_id_fkey(full_name)')
      .eq('examination_id', examId);
    setBusy(false);
    if (loadError) { setError(loadError.message); return; }
    setSheets(data || []);
  }

  const count = (s: string) => (sheets || []).filter((x) => x.status === s).length;
  const pending = (sheets || []).filter((x) => x.status !== 'verified')
    .sort((a, b) => (a.classes?.grade || 0) - (b.classes?.grade || 0));

  return (
    <section className="panel">
      <div className="panel-head"><div><h3>Marks submission status</h3><p>Which teachers still have marks to enter or submit.</p></div></div>
      <div className="form-grid">
        <label>Examination
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.status}</option>)}
          </select>
        </label>
      </div>
      <div className="row-actions" style={{ margin: '10px 0' }}>
        <button className="primary-btn" onClick={run} disabled={busy || !examId}><Play size={15} /> {busy ? 'Loading…' : 'Show report'}</button>
        <button className="secondary-btn" disabled={!sheets?.length} onClick={() =>
          downloadCsv('marks_submission.csv', [['Class', 'Section', 'Subject', 'Teacher', 'Status'],
            ...(sheets || []).map((s) => [s.classes?.name, s.sections?.name, s.subjects?.name, s.profiles?.full_name, s.status])])}><Download size={15} /> CSV</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {sheets && sheets.length === 0 && <div className="loading-row">No mark sheets for this examination yet.</div>}
      {sheets && sheets.length > 0 && (
        <>
          <Bars rows={[['Verified', count('verified'), '#2ea86b'], ['Waiting to verify', count('submitted'), '#e6a23c'], ['Correction requested', count('changes_requested'), '#e0566f'], ['Teacher entering', count('draft'), '#7b8bb0']]} />
          <h4 style={{ margin: '18px 0 8px' }}>Still pending ({pending.length})</h4>
          {pending.length === 0 ? <div className="loading-row">Everything is verified.</div> : (
            <div className="audit-list">
              {pending.map((s) => (
                <div className="audit-row" key={s.id} style={{ gridTemplateColumns: '1.3fr 1.3fr 1.2fr auto' }}>
                  <strong>{s.classes?.name} · {s.sections?.name}</strong>
                  <span>{s.subjects?.name}</span>
                  <span>{s.profiles?.full_name || 'Teacher'}</span>
                  <span className={`status ${s.status}`}>{String(s.status).replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- results */
function ResultsReport({ exams }: { exams: any[] }) {
  const [examId, setExamId] = useState(exams[0]?.id || '');
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    const supabase = createClient();
    if (!supabase || !examId) return;
    setBusy(true); setError('');
    const { data, error: loadError } = await supabase
      .from('exam_results')
      .select('percentage,grade,gpa,result_status,is_published,rank,classes(name,grade),sections(name),profiles!exam_results_student_id_fkey(full_name)')
      .eq('examination_id', examId)
      .limit(5000);
    setBusy(false);
    if (loadError) { setError(loadError.message); return; }
    setResults(data || []);
  }

  const stats = useMemo(() => {
    const list = results || [];
    const pass = list.filter((r) => r.result_status === 'pass').length;
    const avg = list.length ? list.reduce((a, r) => a + Number(r.percentage), 0) / list.length : 0;
    const top = [...list].sort((a, b) => Number(b.percentage) - Number(a.percentage))[0];
    const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'F'].map((g) => [g, list.filter((r) => r.grade === g).length] as [string, number]);
    const groups = new Map<string, any>();
    for (const r of list) {
      const key = `${r.classes?.grade || 0}|${r.classes?.name} · ${r.sections?.name}`;
      const g = groups.get(key) || { label: `${r.classes?.name} · ${r.sections?.name}`, grade: r.classes?.grade || 0, n: 0, pass: 0, sum: 0 };
      g.n += 1; g.sum += Number(r.percentage); if (r.result_status === 'pass') g.pass += 1;
      groups.set(key, g);
    }
    return { total: list.length, pass, fail: list.length - pass, avg, top, grades, groups: [...groups.values()].sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label)) };
  }, [results]);

  return (
    <section className="panel">
      <div className="panel-head"><div><h3>Result statistics</h3><p>Available after results are generated.</p></div></div>
      <div className="form-grid">
        <label>Examination
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.status}</option>)}
          </select>
        </label>
      </div>
      <div className="row-actions" style={{ margin: '10px 0' }}>
        <button className="primary-btn" onClick={run} disabled={busy || !examId}><Play size={15} /> {busy ? 'Loading…' : 'Show report'}</button>
        <button className="secondary-btn" disabled={!results?.length} onClick={() =>
          downloadCsv('results.csv', [['Class', 'Section', 'Student', 'Percentage', 'Grade', 'GPA', 'Result', 'Rank', 'Published'],
            ...(results || []).map((r) => [r.classes?.name, r.sections?.name, r.profiles?.full_name, r.percentage, r.grade, r.gpa, r.result_status, r.rank, r.is_published ? 'Yes' : 'No'])])}><Download size={15} /> CSV</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {results && results.length === 0 && <div className="loading-row">No results generated for this examination yet.</div>}
      {results && results.length > 0 && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-copy"><span>Students</span><strong>{stats.total}</strong></div></div>
            <div className="stat-card"><div className="stat-copy"><span>Pass rate</span><strong>{Math.round((stats.pass / stats.total) * 1000) / 10}%</strong><small>{stats.pass} passed · {stats.fail} failed</small></div></div>
            <div className="stat-card"><div className="stat-copy"><span>Average</span><strong>{Math.round(stats.avg * 10) / 10}%</strong></div></div>
            <div className="stat-card"><div className="stat-copy"><span>Highest</span><strong>{stats.top?.percentage}%</strong><small>{stats.top?.profiles?.full_name}</small></div></div>
          </div>
          <h4 style={{ margin: '18px 0 8px' }}>Grade distribution</h4>
          <Bars rows={stats.grades.map(([g, n]) => [g, n, g === 'F' ? '#e0566f' : '#2ea86b'] as [string, number, string])} />
          <h4 style={{ margin: '18px 0 8px' }}>By class and section</h4>
          <div className="audit-list">
            {stats.groups.map((g) => (
              <div className="audit-row" key={g.label} style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                <strong>{g.label}</strong>
                <span>{g.n} students</span>
                <span>Pass {Math.round((g.pass / g.n) * 1000) / 10}%</span>
                <span>Average {Math.round((g.sum / g.n) * 10) / 10}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
