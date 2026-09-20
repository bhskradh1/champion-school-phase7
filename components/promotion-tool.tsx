'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckCircle2, Copy, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Year = { id: string; name: string; is_current: boolean; is_archived: boolean };
type Cls = { id: string; name: string; grade: number; academic_year_id: string };
type Sec = { id: string; name: string; class_id: string };

const ACTIONS = [
  ['promote', 'Promote'],
  ['repeat', 'Repeat class'],
  ['graduate', 'Graduate'],
  ['transfer', 'Transfer out'],
] as const;

export default function PromotionTool({ years, classes, sections }: { years: Year[]; classes: Cls[]; sections: Sec[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  /* ------------------------------ academic years ------------------------------ */
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');

  async function yearAction(fn: string, args: Record<string, any>, okText: string) {
    const sb = createClient();
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await sb.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    const extra = fn === 'copy_year_structure' && data ? ` (${(data as any).classes} classes, ${(data as any).sections} sections added)` : '';
    setMsg({ text: okText + extra, ok: true });
    router.refresh();
  }

  /* ------------------------------ promotion ------------------------------ */
  const currentYear = years.find((y) => y.is_current) || years[0];
  const [fromYear, setFromYear] = useState(currentYear?.id || '');
  const openYears = years.filter((y) => !y.is_archived);
  const [toYear, setToYear] = useState(openYears.find((y) => y.id !== currentYear?.id)?.id || '');
  const [fromClass, setFromClass] = useState('');
  const [fromSection, setFromSection] = useState('');
  const [sectionOverride, setSectionOverride] = useState('');
  const [students, setStudents] = useState<any[] | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);

  const fromClasses = classes.filter((c) => c.academic_year_id === fromYear);
  const fromClassObj = classes.find((c) => c.id === fromClass);
  const fromSections = sections.filter((s) => s.class_id === fromClass);

  const promoteClass = fromClassObj ? classes.find((c) => c.academic_year_id === toYear && c.grade === fromClassObj.grade + 1) : undefined;
  const repeatClass = fromClassObj ? classes.find((c) => c.academic_year_id === toYear && c.grade === fromClassObj.grade) : undefined;
  const promoteSections = sections.filter((s) => s.class_id === promoteClass?.id);

  useEffect(() => {
    setStudents(null);
    setActions({});
    if (!fromYear || !fromClass) return;
    const sb = createClient();
    if (!sb) return;
    let active = true;
    let q = sb
      .from('student_enrollments')
      .select('student_id,roll_no,section_id,sections(name),profiles!student_enrollments_student_id_fkey(full_name)')
      .eq('academic_year_id', fromYear)
      .eq('class_id', fromClass)
      .eq('is_active', true)
      .order('roll_no', { ascending: true, nullsFirst: false })
      .limit(500);
    if (fromSection) q = q.eq('section_id', fromSection);
    q.then(({ data, error }) => {
      if (!active) return;
      if (error) setMsg({ text: error.message, ok: false });
      setStudents(data || []);
    });
    return () => { active = false; };
  }, [fromYear, fromClass, fromSection, reload]);

  const defaultAction = fromClassObj && fromClassObj.grade >= 12 ? 'graduate' : 'promote';
  const actionOf = (id: string) => actions[id] || defaultAction;
  const setAll = (a: string) => setActions(Object.fromEntries((students || []).map((s) => [s.student_id, a])));

  function pickSection(classId: string, sourceName?: string, override?: string) {
    const list = sections.filter((s) => s.class_id === classId);
    if (override) return list.find((s) => s.id === override)?.id || list[0]?.id;
    return (list.find((s) => s.name === sourceName) || list[0])?.id;
  }

  async function apply() {
    const sb = createClient();
    if (!sb || !students?.length) return;
    if (!toYear) { setMsg({ text: 'Choose the year you are promoting students into.', ok: false }); return; }
    if (toYear === fromYear) { setMsg({ text: 'The "to" year must be different from the "from" year.', ok: false }); return; }

    const items: any[] = [];
    for (const st of students) {
      const action = actionOf(st.student_id);
      if (action === 'promote' || action === 'repeat') {
        const target = action === 'promote' ? promoteClass : repeatClass;
        if (!target) {
          setMsg({ text: `The target year has no ${action === 'promote' ? `Class ${(fromClassObj?.grade || 0) + 1}` : `Class ${fromClassObj?.grade}`}. Copy the classes into that year first (see "Academic years" above).`, ok: false });
          return;
        }
        const sectionId = pickSection(target.id, st.sections?.name, action === 'promote' ? sectionOverride : '');
        if (!sectionId) { setMsg({ text: `${target.name} has no sections in the target year.`, ok: false }); return; }
        items.push({ student_id: st.student_id, action, class_id: target.id, section_id: sectionId });
      } else {
        items.push({ student_id: st.student_id, action });
      }
    }

    const summary = ACTIONS.map(([k, label]) => `${label}: ${items.filter((i) => i.action === k).length}`).join('  ·  ');
    if (!window.confirm(`Apply to ${items.length} students?\n\n${summary}\n\nOld records are kept as history.`)) return;

    setBusy(true);
    setMsg(null);
    const { data, error } = await sb.rpc('promote_students', { p_target_year: toYear, p_items: items });
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    const r = data as any;
    setMsg({ text: `Done. Promoted ${r.promoted}, repeating ${r.repeated}, graduated ${r.graduated}, transferred ${r.transferred}.`, ok: true });
    setReload((n) => n + 1);
  }

  return (
    <>
      {msg && <div className={msg.ok ? 'form-success' : 'form-error'} style={{ marginBottom: 14 }}>{msg.text}</div>}

      {/* ------------------------------ academic years ------------------------------ */}
      <section className="panel">
        <div className="panel-head">
          <div><h3>Academic years</h3><p>Only one year is current. Archived years stay readable but cannot receive new students.</p></div>
        </div>
        <div className="audit-list">
          {years.map((y) => (
            <div className="audit-row" key={y.id} style={{ gridTemplateColumns: '1.5fr 1fr auto' }}>
              <strong>{y.name}</strong>
              <span>{y.is_current ? 'Current' : y.is_archived ? 'Archived' : 'Open'}</span>
              <div className="row-actions">
                {!y.is_current && !y.is_archived && (
                  <button className="mini-btn" disabled={busy} onClick={() => yearAction('set_current_academic_year', { p_year_id: y.id }, `${y.name} is now the current year.`)}>
                    <CheckCircle2 size={14} /> Make current
                  </button>
                )}
                {!y.is_current && (
                  <button className="mini-btn" disabled={busy} onClick={() => yearAction('archive_academic_year', { p_year_id: y.id, p_archived: !y.is_archived }, y.is_archived ? `${y.name} was unarchived.` : `${y.name} was archived.`)}>
                    <Archive size={14} /> {y.is_archived ? 'Unarchive' : 'Archive'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ margin: '18px 0 8px' }}>Prepare a new year: copy classes and sections</h4>
        <div className="form-grid five">
          <label>Copy from
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Select year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </label>
          <label>Copy into
            <select value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>
              <option value="">Select year</option>
              {openYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </label>
        </div>
        <button className="secondary-btn" style={{ marginTop: 10 }} disabled={busy || !copyFrom || !copyTo}
          onClick={() => yearAction('copy_year_structure', { p_from: copyFrom, p_to: copyTo }, 'Classes and sections copied.')}>
          <Copy size={15} /> Copy classes &amp; sections
        </button>
        <p className="muted" style={{ marginTop: 8 }}>Teacher assignments are not copied. Assign teachers again for the new year in Classes.</p>
      </section>

      {/* ------------------------------ promotion ------------------------------ */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div><h3>Promote students</h3><p>Choose one class at a time. Each student gets a NEW enrollment in the next year; the old one is kept as history.</p></div>
        </div>

        <div className="form-grid five">
          <label>From year
            <select value={fromYear} onChange={(e) => { setFromYear(e.target.value); setFromClass(''); setFromSection(''); }}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' · current' : ''}</option>)}
            </select>
          </label>
          <label>Class
            <select value={fromClass} onChange={(e) => { setFromClass(e.target.value); setFromSection(''); }}>
              <option value="">Select class</option>
              {fromClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Section
            <select value={fromSection} onChange={(e) => setFromSection(e.target.value)} disabled={!fromClass}>
              <option value="">All sections</option>
              {fromSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Into year
            <select value={toYear} onChange={(e) => setToYear(e.target.value)}>
              <option value="">Select year</option>
              {openYears.filter((y) => y.id !== fromYear).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </label>
          <label>Section in new class
            <select value={sectionOverride} onChange={(e) => setSectionOverride(e.target.value)} disabled={!promoteClass}>
              <option value="">Same section as before</option>
              {promoteSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>

        {fromClassObj && toYear && (
          <p className="muted" style={{ margin: '10px 0' }}>
            Promote → <strong>{promoteClass ? promoteClass.name : `Class ${fromClassObj.grade + 1} (missing in that year)`}</strong>
            {' · '}Repeat → <strong>{repeatClass ? repeatClass.name : `Class ${fromClassObj.grade} (missing in that year)`}</strong>
          </p>
        )}

        {students === null && fromClass && <div className="loading-row">Loading students…</div>}
        {students && students.length === 0 && <div className="loading-row">No active students in this class.</div>}

        {students && students.length > 0 && (
          <>
            <div className="row-actions" style={{ margin: '10px 0' }}>
              <span className="muted">Set everyone to:</span>
              {ACTIONS.map(([k, label]) => <button key={k} className="mini-btn" onClick={() => setAll(k)}>{label}</button>)}
            </div>
            <div className="audit-list">
              {students.map((st) => (
                <div className="audit-row" key={st.student_id} style={{ gridTemplateColumns: '60px 1.6fr 80px 1fr' }}>
                  <span>{st.roll_no ?? '—'}</span>
                  <strong>{st.profiles?.full_name || 'Student'}</strong>
                  <span>{st.sections?.name}</span>
                  <select value={actionOf(st.student_id)} onChange={(e) => setActions((a) => ({ ...a, [st.student_id]: e.target.value }))}>
                    {ACTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button className="primary-btn" style={{ marginTop: 14 }} disabled={busy || !toYear} onClick={apply}>
              <Play size={15} /> {busy ? 'Working…' : `Apply to ${students.length} students`}
            </button>
          </>
        )}
      </section>
    </>
  );
}
