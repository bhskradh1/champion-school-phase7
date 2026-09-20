'use client';

import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';

const label = (action: string) =>
  action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function summary(meta: any) {
  if (!meta || typeof meta !== 'object') return '';
  const text = Object.entries(meta)
    .filter(([, v]) => v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
  return text.length > 220 ? text.slice(0, 220) + '…' : text;
}

export default function AuditLogView({ logs }: { logs: any[] }) {
  const [query, setQuery] = useState('');
  const [entity, setEntity] = useState('all');

  const entities = useMemo(() => ['all', ...Array.from(new Set(logs.map((l) => l.entity_type))).sort()], [logs]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return logs.filter((l) => {
      if (entity !== 'all' && l.entity_type !== entity) return false;
      if (!needle) return true;
      return [l.action, l.entity_type, l.profiles?.full_name, summary(l.metadata)].join(' ').toLowerCase().includes(needle);
    });
  }, [logs, query, entity]);

  function download() {
    const rows = [['When', 'Who', 'Action', 'Type', 'Details'], ...filtered.map((l) => [new Date(l.created_at).toLocaleString(), l.profiles?.full_name || 'System', label(l.action), l.entity_type, summary(l.metadata)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{filtered.length} events</h3>
          <p>Showing the latest 500 events.</p>
        </div>
        <button className="secondary-btn" onClick={download} disabled={!filtered.length}>
          <Download size={15} /> CSV
        </button>
      </div>

      <div className="student-toolbar">
        <div className="search wide">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person, action or details" />
        </div>
        <select value={entity} onChange={(e) => setEntity(e.target.value)}>
          {entities.map((e) => (
            <option key={e} value={e}>{e === 'all' ? 'All types' : label(e)}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="loading-row">No events found.</div>
      ) : (
        <div className="audit-list">
          {filtered.map((l) => (
            <div className="audit-row" key={l.id}>
              <div>
                <strong>{label(l.action)}</strong>
                <span>{l.entity_type.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <strong>{l.profiles?.full_name || 'System'}</strong>
                <span>{l.profiles?.role || ''}</span>
              </div>
              <span className="muted audit-details">{summary(l.metadata)}</span>
              <time>{new Date(l.created_at).toLocaleString()}</time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
