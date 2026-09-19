import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/results/pdf
 * Create a bulk PDF generation job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { examination_id, class_id, section_id } = body;

    if (!examination_id || !class_id) {
      return NextResponse.json(
        { error: 'Examination ID and Class ID are required' },
        { status: 400 }
      );
    }

    // Verify permissions
    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!me || (me.role !== 'admin' && me.role !== 'teacher')) {
      return NextResponse.json(
        { error: 'Only admin and teachers can generate bulk PDFs' },
        { status: 403 }
      );
    }

    // If teacher, verify they are class teacher for this class/section
    if (me.role === 'teacher') {
      const { data: isClassTeacher } = await supabase.rpc(
        'is_class_teacher_for_scope',
        {
          p_class_id: class_id,
          p_section_id: section_id || null
        }
      );

      if (!isClassTeacher) {
        return NextResponse.json(
          { error: 'Only class teacher can generate bulk PDFs for this class' },
          { status: 403 }
        );
      }
    }

    // Create PDF job
    const { data: job, error: jobError } = await supabase
      .from('result_pdf_jobs')
      .insert({
        examination_id,
        class_id,
        section_id: section_id || null,
        total_students: 0, // Will be updated
        status: 'pending',
        created_by: user.id
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating PDF job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create PDF generation job' },
        { status: 500 }
      );
    }

    // Create individual job items for each result
    let query = supabase
      .from('exam_results')
      .select('id, student_id')
      .eq('examination_id', examination_id)
      .eq('class_id', class_id)
      .eq('is_published', true);

    if (section_id) {
      query = query.eq('section_id', section_id);
    }

    const { data: results } = await query;

    if (results && results.length > 0) {
      const jobItems = results.map(r => ({
        job_id: job.id,
        result_id: r.id,
        student_id: r.student_id,
        status: 'pending' as const
      }));

      const { error: itemsError } = await supabase
        .from('result_pdf_job_items')
        .insert(jobItems);

      if (itemsError) {
        console.error('Error creating job items:', itemsError);
      }

      // Update total count
      await supabase
        .from('result_pdf_jobs')
        .update({ total_students: results.length })
        .eq('id', job.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        job_id: job.id,
        total_students: results?.length || 0,
        message: 'PDF generation job created. Processing will begin shortly.'
      }
    });
  } catch (error) {
    console.error('Error creating PDF job:', error);
    return NextResponse.json(
      { error: 'Failed to create PDF generation job' },
      { status: 500 }
    );
  }
}
