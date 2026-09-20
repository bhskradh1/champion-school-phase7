import TeachersManagement from '@/components/teachers-management';
import { createClient } from '@/lib/supabase/server';

/*
 * PERFORMANCE: the teacher list is now loaded on the SERVER and arrives with the
 * page. Before, the page loaded empty, downloaded its JavaScript, and only THEN
 * asked Supabase for the teachers from the browser (a "waterfall").
 */
export default async function TeachersPage() {
  const supabase = await createClient();

  let teachers: any[] = [];

  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('id,full_name,email,phone,is_active,created_at')
      .eq('role', 'teacher')
      .order('full_name');

    teachers = data || [];
  }

  return <TeachersManagement initialTeachers={teachers} />;
}
