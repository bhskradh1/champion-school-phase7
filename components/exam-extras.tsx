'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, History, Lock, RotateCcw, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

/* Everything the ADMIN needs on the exam page: deadline control, verification matrix, full/pass marks. */
export function ExamAdminPanel({ exam, sheets, onChanged }: { exam: any; sheets: any[]; onChanged: () => void }) {
  return (
    <>
      <ExamControls exam={exam} onChanged={onChanged} />
      <VerificationMatrix sheets={sheets} />
      <ExamSubjectSetup exam={exam} sheets={sheets} onChanged={onChanged} />
    </>
  );
}

/* ---------- Deadline / reopen / lock (every action is written to the audit log) ---------- */
function ExamControls({ exam, onChanged }: { exam: any; onChanged: () => void }) {
  const supabase = createClient();
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const passed = exam.marks_deadline && new Date(exam.marks_deadline) < new Date();

  async function run(action: 'extend' | 'reopen' | 'lock') {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('admin_control_exam', {
      p_exam_id: exam.id,
      p_action: action,
      p_deadline: deadline ? new Date(deadline).toISOString() : null,
      p_note: note || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    setMsg({
      ok: true,
      text:
        action === 'extend'
          ? 'Deadline extended.'
          : action === 'reopen'
          ? 'Examination reopened for marks entry.'
          : 'Examination locked. Teachers can no longer change marks.',
    });
    setDeadline('');
    setNote('');
    onChanged();
  }

  return (
    <section className="card exam-controls">
      <div className="panel-head">
        <div>
          <span className="section-kicker"><CalendarClock size={15} /> MARKS ENTRY CONTROL</span>
          <h3>Deadline &amp; access</h3>
        </div>
        <span className={`status ${exam.status}`}>{exam.status}</span>
      </div>
      <p className="muted">
        Deadline: <strong>{fmt(exam.marks_deadline)}</strong>
        {passed && <span style={{ color: '#c13f52' }}> · passed — teachers can no longer save or submit</span>}
      </p>
      <div className="form-grid five">
        <label>New deadline
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label>Note (kept in the audit log)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional reason" />
        </label>
      </div>
      {msg && <div className={msg.ok ? 'form-success' : 'form-error'}>{msg.text}</div>}
      <div className="row-actions" style={{ marginTop: 10 }}>
        <button className="secondary-btn" disabled={busy || !deadline} onClick={() => run('extend')}>
          <Clock3 size={15} /> Extend deadline
        </button>
        <button className="secondary-btn" disabled={busy || exam.status === 'draft'} onClick={() => run('reopen')}>
          <RotateCcw size={15} /> Reopen
        </button>
        <button className="secondary-btn danger" disabled={busy || exam.status !== 'open'} onClick={() => run('lock')}>
          <Lock size={15} /> Lock
        </button>
      </div>
    </section>
  );
}

/* ---------- Verification matrix: one row per class/section, one chip per subject ---------- */
const CHIP: Record<string, { icon: string; label: string }> = {
  verified: { icon: '✓', label: 'Verified' },
  submitted: { icon: '⏳', label: 'Waiting for admin' },
  changes_requested: { icon: '⚠', label: 'Correction required' },
  draft: { icon: '•', label: 'Teacher is entering marks' },
};

function VerificationMatrix({ sheets }: { sheets: any[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; grade: number; rows: any[] }>();
    for (const s of sheets) {
      const key = `${s.class_id}:${s.section_id}`;
      if (!map.has(key)) {
        map.set(key, { key, label: `${s.classes?.name || ''} · ${s.sections?.name || ''}`, grade: s.classes?.grade || 0, rows: [] });
      }
      map.get(key)!.rows.push(s);
    }
    return [...map.values()].sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label));
  }, [sheets]);

  if (!groups.length) return null;

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <span className="section-kicker">VERIFICATION</span>
          <h3>Submission status by class</h3>
        </div>
      </div>
      <div className="matrix">
        {groups.map((g) => {
          const done = g.rows.filter((r) => r.status === 'verified').length;
          return (
            <div className="matrix-row" key={g.key}>
              <strong>{g.label}</strong>
              <div className="matrix-chips">
                {[...g.rows]
                  .sort((a, b) => (a.subjects?.name || '').localeCompare(b.subjects?.name || ''))
                  .map((s) => (
                    <span
                      key={s.id}
                      className={`matrix-chip ${s.status}`}
                      title={`${CHIP[s.status]?.label || s.status}${s.profiles?.full_name ? ' · ' + s.profiles.full_name : ''}`}
                    >
                      {CHIP[s.status]?.icon} {s.subjects?.name}
                    </span>
                  ))}
              </div>
              <span className="muted">{done}/{g.rows.length} verified</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Full marks + pass marks per class and subject ---------- */
function ExamSubjectSetup({ exam, sheets, onChanged }: { exam: any; sheets: any[]; onChanged: () => void }) {
  const supabase = createClient();
  const [saved, setSaved] = useState<Record<string, { full: number; pass: number }>>({});
  const [edits, setEdits] = useState<Record<string, { full: string; pass: string }>>({});
  const [busyKey, setBusyKey] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const rows = useMemo(() => {
    const map = new Map<string, { key: string; class_id: string; subject_id: string; label: string; grade: number }>();
    for (const s of sheets) {
      const key = `${s.class_id}:${s.subject_id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          class_id: s.class_id,
          subject_id: s.subject_id,
          label: `${s.classes?.name || ''} · ${s.subjects?.name || ''}`,
          grade: s.classes?.grade || 0,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label));
  }, [sheets]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase
      .from('exam_subjects')
      .select('class_id,subject_id,full_marks,pass_marks')
      .eq('examination_id', exam.id)
      .then(({ data }) => {
        if (!active) return;
        const next: Record<string, { full: number; pass: number }> = {};
        for (const r of data || []) next[`${r.class_id}:${r.subject_id}`] = { full: Number(r.full_marks), pass: Number(r.pass_marks) };
        setSaved(next);
        setEdits({});
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, sheets.length]);

  if (!rows.length) return null;

  const locked = exam.status === 'completed';

  async function save(row: { key: string; class_id: string; subject_id: string }) {
    if (!supabase) return;
    const current = saved[row.key] || { full: 100, pass: 40 };
    const edit = edits[row.key] || { full: String(current.full), pass: String(current.pass) };
    setBusyKey(row.key);
    setMsg(null);
    const { error } = await supabase.rpc('set_exam_subject_marks', {
      p_exam_id: exam.id,
      p_class_id: row.class_id,
      p_subject_id: row.subject_id,
      p_full: Number(edit.full),
      p_pass: Number(edit.pass),
    });
    setBusyKey('');
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    setSaved((s) => ({ ...s, [row.key]: { full: Number(edit.full), pass: Number(edit.pass) } }));
    setEdits((e) => { const { [row.key]: _, ...rest } = e; return rest; });
    setMsg({ text: 'Saved. Teachers now see the new full marks.', ok: true });
    onChanged();
  }

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <span className="section-kicker">MARKS SETUP</span>
          <h3>Full marks &amp; pass marks</h3>
          <p>Set these before teachers enter marks. A student fails a subject when marks are below the pass marks.</p>
        </div>
      </div>
      {locked && <div className="notice">Results are generated. Reopen the examination to change these.</div>}
      {msg && <div className={msg.ok ? 'form-success' : 'form-error'}>{msg.text}</div>}
      <div className="subject-setup">
        {rows.map((row) => {
          const cur = saved[row.key] || { full: 100, pass: 40 };
          const edit = edits[row.key] || { full: String(cur.full), pass: String(cur.pass) };
          const changed = Number(edit.full) !== cur.full || Number(edit.pass) !== cur.pass;
          return (
            <div className="subject-setup-row" key={row.key}>
              <strong>{row.label}</strong>
              <label>Full marks
                <input type="number" min="1" step="0.5" value={edit.full} disabled={locked}
                  onChange={(e) => setEdits((s) => ({ ...s, [row.key]: { ...edit, full: e.target.value } }))} />
              </label>
              <label>Pass marks
                <input type="number" min="0" step="0.5" value={edit.pass} disabled={locked}
                  onChange={(e) => setEdits((s) => ({ ...s, [row.key]: { ...edit, pass: e.target.value } }))} />
              </label>
              <button className="secondary-btn" disabled={locked || !changed || busyKey === row.key} onClick={() => save(row)}>
                <Save size={14} /> Save
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Correction history of one mark sheet ---------- */
export function SheetHistory({ sheetId, marks }: { sheetId: string; marks: any[] }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of marks) map[m.student_id] = m.profiles?.full_name || 'Student';
    return map;
  }, [marks]);

  async function show() {
    setOpen(true);
    setItems(null);
    setError('');
    if (!supabase) return;
    const { data, error: loadError } = await supabase
      .from('exam_mark_history')
      .select('id,student_id,old_marks,new_marks,old_remarks,new_remarks,sheet_status,reason,created_at,profiles!exam_mark_history_changed_by_fkey(full_name)')
      .eq('mark_sheet_id', sheetId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (loadError) setError(loadError.message);
    else setItems(data || []);
  }

  return (
    <>
      <button className="secondary-btn" onClick={show}><History size={13} /> History</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Correction history</h2><p>Every change to a mark that was already entered.</p></div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            {error && <div className="form-error">{error}</div>}
            {!items && !error && <div className="loading-row">Loading…</div>}
            {items && items.length === 0 && <div className="loading-row">No corrections yet. Marks have not been changed after they were first entered.</div>}
            {items && items.length > 0 && (
              <div className="history-list">
                {items.map((h) => (
                  <div className="history-row" key={h.id}>
                    <div>
                      <strong>{names[h.student_id] || 'Student'}</strong>
                      <span>{new Date(h.created_at).toLocaleString()} · by {h.profiles?.full_name || 'unknown'}</span>
                    </div>
                    <div className="history-change">
                      <b>{h.old_marks ?? '—'}</b> → <b>{h.new_marks ?? '—'}</b>
                    </div>
                    {(h.reason || h.sheet_status) && (
                      <span className="muted">{h.sheet_status ? `Sheet: ${String(h.sheet_status).replace('_', ' ')}` : ''}{h.reason ? ` · Note: ${h.reason}` : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
