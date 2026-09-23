'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Flag, ShieldOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/* Admin only: messages that people reported, and who is currently restricted. */
export default function DiscussionReports({ onChanged }: { onChanged: () => void }) {
  const supabase = createClient();
  const [reports, setReports] = useState<any[]>([]);
  const [restricted, setRestricted] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: r }, { data: x }] = await Promise.all([
      supabase
        .from('discussion_reports')
        .select(
          'id,reason,created_at,thread_id,reply_id,' +
          'reporter:profiles!discussion_reports_reporter_id_fkey(full_name),' +
          'thread:discussion_threads!discussion_reports_thread_id_fkey(title,body,author_id,author:profiles!discussion_threads_author_id_fkey(full_name)),' +
          'reply:discussion_replies!discussion_reports_reply_id_fkey(body,author_id,author:profiles!discussion_replies_author_id_fkey(full_name))'
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('discussion_restrictions')
        .select('id,user_id,reason,until,person:profiles!discussion_restrictions_user_id_fkey(full_name)')
        .is('lifted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    setReports((r as any[]) || []);
    setRestricted(((x as any[]) || []).filter((row) => !row.until || new Date(row.until) > new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: string, action: 'dismiss' | 'delete' | 'restrict') {
    if (!supabase) return;
    let days: number | null = null;
    if (action === 'restrict') {
      const answer = window.prompt('Restrict the author from posting.\nFor how many days? (leave empty = until you lift it)', '7');
      if (answer === null) return;
      days = answer.trim() === '' ? null : Number(answer);
      if (days !== null && (!Number.isInteger(days) || days < 1)) { setMsg('Enter a whole number of days.'); return; }
    } else if (action === 'delete' && !window.confirm('Remove this message for everyone?')) {
      return;
    }
    setBusy(true);
    setMsg('');
    const { error } = await supabase.rpc('resolve_discussion_report', { p_report_id: id, p_action: action, p_days: days, p_note: null });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    await load();
    onChanged();
  }

  async function lift(userId: string) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc('lift_discussion_restriction', { p_user_id: userId });
    setBusy(false);
    if (error) setMsg(error.message);
    await load();
  }

  if (reports.length === 0 && restricted.length === 0 && !msg) return null;

  return (
    <section className="discussion-composer card">
      <div className="section-kicker"><Flag size={15} /> MODERATION</div>
      <h2>Reported messages ({reports.length})</h2>
      {msg && <div className="form-error">{msg}</div>}

      <div className="audit-list">
        {reports.map((r) => {
          const content = r.reply?.body || r.thread?.title || '';
          const author = r.reply?.author?.full_name || r.thread?.author?.full_name || 'Unknown';
          return (
            <div className="audit-row" key={r.id} style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <strong>{r.reply ? 'Reply' : 'Post'} by {author}</strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>“{content.slice(0, 300)}”</span>
                <span>Reported by {r.reporter?.full_name || 'someone'}: {r.reason}</span>
              </div>
              <div className="row-actions">
                <button className="mini-btn" disabled={busy} onClick={() => resolve(r.id, 'dismiss')}>Dismiss</button>
                <button className="mini-btn danger" disabled={busy} onClick={() => resolve(r.id, 'delete')}>Remove message</button>
                <button className="mini-btn danger" disabled={busy} onClick={() => resolve(r.id, 'restrict')}><Ban size={13} /> Remove &amp; restrict author</button>
              </div>
            </div>
          );
        })}
      </div>

      {restricted.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Currently restricted</h3>
          <div className="audit-list">
            {restricted.map((x) => (
              <div className="audit-row" key={x.id} style={{ gridTemplateColumns: '1.4fr 1.4fr auto' }}>
                <strong>{x.person?.full_name || 'Person'}</strong>
                <span>{x.until ? `until ${new Date(x.until).toLocaleDateString()}` : 'until lifted'}</span>
                <button className="mini-btn" disabled={busy} onClick={() => lift(x.user_id)}><ShieldOff size={13} /> Lift</button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
