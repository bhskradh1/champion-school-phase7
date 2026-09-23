'use client';
import { Bell, Megaphone, Send, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SELECT =
  'id,title,body,target_audience,audience_class_id,audience_section_id,audience_user_id,is_published,published_at,expires_at,created_at,created_by,' +
  'audience_class:classes!announcements_audience_class_id_fkey(name),' +
  'audience_section:sections!announcements_audience_section_id_fkey(name),' +
  'audience_person:profiles!announcements_audience_user_id_fkey(full_name)';

function audienceLabel(a: any) {
  switch (a.target_audience) {
    case 'teachers': return 'Teachers only';
    case 'students': return 'Students only';
    case 'class': return a.audience_class?.name ? `${a.audience_class.name} (students and teachers)` : 'One class';
    case 'section': return `${a.audience_class?.name || 'Class'} · ${a.audience_section?.name || 'Section'}`;
    case 'individual': return a.audience_person?.full_name ? `Only ${a.audience_person.full_name}` : 'One person';
    default: return 'Everyone';
  }
}

export default function AnnouncementsManagement({
  role, announcements: initial, classes = [], sections = [],
}: { role: string; announcements: any[]; classes?: any[]; sections?: any[] }) {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', body: '', target_audience: 'all', expires_at: '' });
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [person, setPerson] = useState<{ id: string; full_name: string } | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<any[]>([]);

  const audience = form.target_audience;
  const classSections = sections.filter((s) => s.class_id === classId);

  // Look up people for a one-person announcement
  useEffect(() => {
    if (audience !== 'individual' || personQuery.trim().length < 2 || !supabase) { setPersonResults([]); return; }
    const timer = setTimeout(async () => {
      const q = personQuery.trim().replace(/[%,()]/g, '');
      const { data } = await supabase.from('profiles').select('id,full_name,email,role').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).eq('is_active', true).limit(8);
      setPersonResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personQuery, audience]);

  async function publish() {
    if (!supabase) { setNotice('Preview mode: connect Supabase to publish announcements.'); return; }
    const title = form.title.trim(), body = form.body.trim();
    if (title.length < 2 || body.length < 2) { setNotice('Add a title and message before publishing.'); return; }
    if ((audience === 'class' || audience === 'section') && !classId) { setNotice('Choose the class.'); return; }
    if (audience === 'section' && !sectionId) { setNotice('Choose the section.'); return; }
    if (audience === 'individual' && !person) { setNotice('Search for and choose the person.'); return; }

    setBusy(true); setNotice('');
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const { data, error } = await supabase.from('announcements').insert({
      title, body, target_audience: audience,
      audience_class_id: audience === 'class' || audience === 'section' ? classId : null,
      audience_section_id: audience === 'section' ? sectionId : null,
      audience_user_id: audience === 'individual' ? person?.id : null,
      is_published: true, published_at: new Date().toISOString(),
      expires_at: form.expires_at || null, created_by: user?.id,
    }).select(SELECT).single();
    if (error) setNotice(error.message);
    else {
      setAnnouncements((xs) => [data, ...xs]);
      setForm({ title: '', body: '', target_audience: 'all', expires_at: '' });
      setClassId(''); setSectionId(''); setPerson(null); setPersonQuery('');
      setNotice('Announcement published and delivered to its audience.');
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!supabase || !confirm('Remove this announcement and its delivered notifications?')) return;
    setBusy(true);
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) setNotice(error.message);
    else { setAnnouncements((xs) => xs.filter((x) => x.id !== id)); setNotice('Announcement removed.'); }
    setBusy(false);
  }

  return (
    <div className="announcements-space">
      {role === 'admin' && (
        <section className="card announcement-compose">
          <div className="panel-head"><div>
            <span className="section-kicker"><Megaphone size={15} /> ADMIN PUBLISHING</span>
            <h2>Send an announcement</h2>
            <p>Each person in the chosen audience receives a private in-app notification.</p>
          </div></div>
          <div className="announcement-form">
            <label>Title<input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Parent–teacher meeting" /></label>
            <label>Audience
              <select value={audience} onChange={(e) => { setForm({ ...form, target_audience: e.target.value }); setClassId(''); setSectionId(''); setPerson(null); }}>
                <option value="all">Everyone</option>
                <option value="students">All students</option>
                <option value="teachers">All teachers</option>
                <option value="class">One class (students + its teachers)</option>
                <option value="section">One section</option>
                <option value="individual">One person</option>
              </select>
            </label>

            {(audience === 'class' || audience === 'section') && (
              <label>Class
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
                  <option value="">Select class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {audience === 'section' && (
              <label>Section
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
                  <option value="">Select section</option>
                  {classSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            {audience === 'individual' && (
              <label>Person
                {person ? (
                  <div className="row-actions"><strong>{person.full_name}</strong><button className="mini-btn" onClick={() => { setPerson(null); setPersonQuery(''); }}>Change</button></div>
                ) : (
                  <>
                    <input value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} placeholder="Type a name or email…" />
                    {personResults.length > 0 && (
                      <div className="audit-list">
                        {personResults.map((p) => (
                          <button key={p.id} className="mini-btn" type="button" onClick={() => { setPerson(p); setPersonResults([]); }}>
                            {p.full_name} · {p.role}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </label>
            )}

            <label>Expires on <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
            <label className="announcement-message">Message<textarea value={form.body} maxLength={5000} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the information recipients need to know…" /></label>
          </div>
          {notice && <div className="notice">{notice}</div>}
          <button className="primary-btn" disabled={busy} onClick={publish}><Send size={15} /> Publish &amp; notify</button>
        </section>
      )}

      {role !== 'admin' && notice && <div className="notice">{notice}</div>}

      <section className="announcement-feed">
        <div className="feed-head"><div>
          <span className="section-kicker"><Bell size={15} /> SCHOOL UPDATES</span>
          <h2>{announcements.length} announcement{announcements.length === 1 ? '' : 's'}</h2>
        </div></div>
        {announcements.length === 0 ? (
          <div className="empty-panel"><Bell size={28} /><h3>No announcements right now</h3><p>New school updates will appear here.</p></div>
        ) : announcements.map((a) => (
          <article className="card announcement-card" key={a.id}>
            <div className="announcement-icon"><Megaphone size={19} /></div>
            <div className="announcement-content">
              <div className="announcement-meta">
                <span className="audience-chip"><Users size={12} />{audienceLabel(a)}</span>
                <time>{new Date(a.published_at || a.created_at).toLocaleString()}</time>
                {a.expires_at && <time>Expires {new Date(a.expires_at).toLocaleDateString()}</time>}
              </div>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
              <small>Published by {a.profiles?.full_name || 'School Admin'}</small>
            </div>
            {role === 'admin' && <button className="icon-btn danger" title="Remove announcement" disabled={busy} onClick={() => remove(a.id)}><Trash2 size={16} /></button>}
          </article>
        ))}
      </section>
    </div>
  );
}
