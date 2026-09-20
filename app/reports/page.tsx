import { redirect } from 'next/navigation';
import PageShell from '@/components/page-shell';
import ReportsView from '@/components/reports-view';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getSchoolReferenceData } from '@/lib/supabase/cache';

export default async function ReportsPage() {
  const { supabase, userId, profile } = await getCurrentUser();

  if (!supabase) {
    return (
      <PageShell role="admin" title="Reports" subtitle="Attendance, examination and result reports.">
        <ReportsView classes={[]} sections={[]} exams={[]} />
      </PageShell>
    );
  }

  if (!userId) redirect('/login');
  const role = profile?.role || 'student';
  if (role === 'student') redirect('/dashboard');

  const [reference, examsResult] = await Promise.all([
    getSchoolReferenceData(),
    supabase
      .from('examinations')
      .select('id,name,status,starts_on')
      .order('starts_on', { ascending: false, nullsFirst: false }),
  ]);

  return (
    <PageShell
      role={role}
      title="Reports"
      subtitle={role === 'admin' ? 'Attendance, examination and result reports for the whole school.' : 'Reports for the classes you are responsible for.'}
      chip={role === 'admin' ? 'Admin' : 'Your classes only'}
    >
      <ReportsView classes={reference.classes} sections={reference.sections} exams={examsResult.data || []} />
    </PageShell>
  );
}
