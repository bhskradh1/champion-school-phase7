'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const SCALE = [
  ['A+', '90% and above', '4.0'],
  ['A', '80% – 89.99%', '3.6'],
  ['B+', '70% – 79.99%', '3.2'],
  ['B', '60% – 69.99%', '2.8'],
  ['C+', '50% – 59.99%', '2.4'],
  ['C', '40% – 49.99%', '2.0'],
  ['F', 'Below 40%', '0'],
];

export default function SettingsForm({
  initial,
}: {
  initial: { threads: number; replies: number; classTeacherPublish: boolean };
}) {
  const [threads, setThreads] = useState(String(initial.threads));
  const [replies, setReplies] = useState(String(initial.replies));
  const [publish, setPublish] = useState(initial.classTeacherPublish);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    const supabase = createClient();
    if (!supabase) return;

    const t = Number(threads);
    const r = Number(replies);
    if (!Number.isInteger(t) || t < 0 || t > 50 || !Number.isInteger(r) || r < 0 || r > 500) {
      setMsg({ text: 'Please enter whole numbers (threads 0–50, replies 0–500).', ok: false });
      return;
    }

    setBusy(true);
    setMsg(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const now = new Date().toISOString();
    const by = session?.user?.id;

    const { error } = await supabase.from('system_settings').upsert(
      [
        { setting_key: 'discussion_thread_limit', setting_value: t, updated_by: by, updated_at: now },
        { setting_key: 'discussion_message_limit', setting_value: r, updated_by: by, updated_at: now },
        { setting_key: 'class_teacher_can_publish_results', setting_value: publish, updated_by: by, updated_at: now },
      ],
      { onConflict: 'setting_key' }
    );

    setBusy(false);
    setMsg(error ? { text: error.message, ok: false } : { text: 'Settings saved. They apply immediately.', ok: true });
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Discussion limits (students)</h3>
            <p>Enforced by the database. Teachers and admins have no limit.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>Threads or polls per student per day
            <input type="number" min="0" max="50" value={threads} onChange={(e) => setThreads(e.target.value)} />
          </label>
          <label>Replies per student per day
            <input type="number" min="0" max="500" value={replies} onChange={(e) => setReplies(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Results</h3>
            <p>Who may publish and unpublish results.</p>
          </div>
        </div>
        <label className="assignment-check" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Class teachers can publish / unpublish results of their own class (admin always can)
        </label>
      </section>

      {msg && <div className={msg.ok ? 'form-success' : 'form-error'}>{msg.text}</div>}
      <button className="primary-btn" onClick={save} disabled={busy}>
        <Save size={16} /> {busy ? 'Saving…' : 'Save settings'}
      </button>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div>
            <h3>Grading scale (used for results)</h3>
            <p>A student also fails a subject if the marks are below that subject&apos;s pass marks (set per exam).</p>
          </div>
        </div>
        <div className="audit-list">
          {SCALE.map(([grade, range, gp]) => (
            <div className="audit-row" key={grade} style={{ gridTemplateColumns: '80px 1fr 90px' }}>
              <strong>{grade}</strong>
              <span className="muted">{range}</span>
              <span>GPA {gp}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
