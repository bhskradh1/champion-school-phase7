const { data: results } =
  await supabase
    .from('exam_results')
    .select(
      `
      id,
      examination_id,
      total_marks,
      total_max_marks,
      percentage,
      grade,
      rank,
      is_published,
      generated_at,
      examinations(name,term,starts_on),
      classes(name),
      sections(name)
      `
    )
    .eq('student_id', user.id)
    .eq('is_published', true)
    .order('generated_at', {
      ascending: false,
    });

const resultIds =
  (results || []).map(
    (result) => result.id
  );

let items: any[] = [];

if (resultIds.length) {
  const { data } =
    await supabase
      .from('exam_result_items')
      .select(
        `
        id,
        result_id,
        subject_id,
        marks,
        max_marks,
        percentage,
        grade,
        subjects(name,code)
        `
      )
      .in(
        'result_id',
        resultIds
      );

  items = data || [];
}
