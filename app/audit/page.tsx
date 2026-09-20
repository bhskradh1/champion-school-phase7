import { redirect } from 'next/navigation';
import PageShell from '@/components/page-shell';
import AuditLogView from '@/components/audit-log-view';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function AuditPage() {
  const { supabase, userId, profile } = await getCurrentUser();

  if (!supabase) {
    return (
      <PageShell role="admin" title="Audit logs" subtitle="Who did what, and when.">
        <AuditLogView logs={[]} />
      </PageShell>
    );
  }

  if (!userId) redirect('/login');
  if (profile?.role !== 'admin') redirect('/dashboard');

  const { data } = await supabase
    .from('audit_logs')
    .select('id,action,entity_type,entity_id,metadata,created_at,profiles!audit_logs_actor_id_fkey(full_name,role)')
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <PageShell
      role="admin"
      title="Audit logs"
      subtitle="Who did what, and when. Useful when there is a dispute about marks, results or attendance."
      chip="Admin only"
    >
      <AuditLogView logs={data || []} />
    </PageShell>
  );
}
