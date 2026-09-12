import { unstable_cache } from 'next/cache';
import { createClient } from './server';

export type SchoolReferenceData = {
  classes: any[];
  sections: any[];
  subjects: any[];
  years: any[];
};

export const getSchoolReferenceData = unstable_cache(
  async (): Promise<SchoolReferenceData> => {
    const supabase = await createClient();
    if (!supabase) {
      return { classes: [], sections: [], subjects: [], years: [] };
    }

    const [{ data: classes }, { data: sections }, { data: subjects }, { data: years }] = await Promise.all([
      supabase.from('classes').select('id,name,grade,academic_year_id').order('grade'),
      supabase.from('sections').select('id,name,class_id').order('name'),
      supabase.from('subjects').select('id,name,code').order('name'),
      supabase.from('academic_years').select('id,name,is_current').order('starts_on', { ascending: false }),
    ]);

    return {
      classes: classes || [],
      sections: sections || [],
      subjects: subjects || [],
      years: years || [],
    };
  },
  ['school-reference-data'],
  { revalidate: 300, tags: ['school-reference-data'] }
);
