import { redirect } from 'next/navigation';
import PageShell from '@/components/page-shell';
import PromotionTool from '@/components/promotion-tool';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function PromotionPage() {
  const { supabase, userId, profile } = await getCurrentUser();

  if (!supabase) {
    return (
      <PageShell role="admin" title="Promotion & academic years" subtitle="Move students to the next class at the end of the year.">
        <PromotionTool years={[]} classes={[]} sections={[]} />
      </PageShell>
    );
  }

  if (!userId) redirect('/login');
  if (profile?.role !== 'admin') redirect('/dashboard');

  const [years, classes, sections] = await Promise.all([
    supabase.from('academic_years').select('id,name,starts_on,ends_on,is_current,is_archived').order('starts_on', { ascending: false }),
    supabase.from('classes').select('id,name,grade,academic_year_id').order('grade'),
    supabase.from('sections').select('id,name,class_id').order('name'),
  ]);

  return (
    <PageShell
      role="admin"
      title="Promotion & academic years"
      subtitle="At the end of the year: prepare the new year, promote students, then make the new year current. Old records are kept."
      chip="Admin only"
    >
      <PromotionTool years={years.data || []} classes={classes.data || []} sections={sections.data || []} />
    </PageShell>
  );
}
