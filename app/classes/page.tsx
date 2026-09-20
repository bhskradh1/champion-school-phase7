import ClassesManagement from '@/components/classes-management';
import { getSchoolReferenceData } from '@/lib/supabase/cache';
import { createClient } from '@/lib/supabase/server';

/*
 * PERFORMANCE: all six lists are loaded on the SERVER, at the same time, and
 * arrive with the page. Before, the page loaded empty, downloaded its
 * JavaScript, and only THEN made 6 requests from the browser.
 */
export default async function ClassesPage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <ClassesManagement
        initial={{ years: [], classes: [], sections: [], subjects: [], teachers: [], assignments: [] }}
      />
    );
  }

  const [reference, teachersResult, assignmentsResult] = await Promise.all([
    getSchoolReferenceData(),

    supabase
      .from('profiles')
      .select('id,full_name')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name'),

    supabase
      .from('teacher_assignments')
      .select('id,teacher_id,class_id,section_id,subject_id,is_class_teacher')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <ClassesManagement
      initial={{
        years: reference.years,
        classes: reference.classes,
        sections: reference.sections,
        subjects: reference.subjects,
        teachers: teachersResult.data || [],
        assignments: assignmentsResult.data || [],
      }}
    />
  );
}
