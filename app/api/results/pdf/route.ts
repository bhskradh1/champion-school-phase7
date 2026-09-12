import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/results/pdf/[resultId]
 * Generate and return result PDF data for a specific result
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resultId } = await params;
    
    // Get user role
    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!me) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get result data using the database function
    const { data: pdfData, error } = await supabase.rpc('get_result_pdf_data', {
      p_result_id: resultId
    });

    if (error || !pdfData) {
      return NextResponse.json(
        { error: 'Result not found or access denied' },
        { status: 404 }
      );
    }

    // Permission check: student can only view their own results
    if (me.role === 'student') {
      const { data: result } = await supabase
        .from('exam_results')
        .select('student_id, is_published')
        .eq('id', resultId)
        .maybeSingle();

      if (!result || result.student_id !== user.id || !result.is_published) {
        return NextResponse.json(
          { error: 'Access denied. Result not published or not yours.' },
          { status: 403 }
        );
      }
    }

    // For teachers/admin, check if they have access to this class/section
    if (me.role === 'teacher' || me.role === 'admin') {
      const { data: result } = await supabase
        .from('exam_results')
        .select('class_id, section_id, is_published')
        .eq('id', resultId)
        .maybeSingle();

      if (!result || !result.is_published) {
        return NextResponse.json(
          { error: 'Result not found or not published' },
          { status: 404 }
        );
      }

      // Check if teacher is class teacher for this class
      if (me.role === 'teacher') {
        const { data: isClassTeacher } = await supabase.rpc(
          'is_class_teacher_for_scope',
          {
            p_class_id: result.class_id,
            p_section_id: result.section_id
          }
        );

        if (!isClassTeacher && !me.role === 'admin') {
          // Also check if teacher teaches any subject in this class
          const { data: teachesSubject } = await supabase
            .from('teacher_assignments')
            .select('id')
            .eq('teacher_id', user.id)
            .eq('class_id', result.class_id)
            .maybeSingle();

          if (!teachesSubject) {
            return NextResponse.json(
              { error: 'Access denied. Not assigned to this class.' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Get template configuration
    const { data: template } = await supabase
      .from('result_pdf_templates')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    // Return structured data for PDF generation
    return NextResponse.json({
      success: true,
      data: {
        ...pdfData,
        template: template || {
          header_text: 'CHAMPION ENGLISH SCHOOL',
          sub_header_text: 'Dharan-15, Sunsari, Nepal',
          footer_left: 'Class Teacher',
          footer_right: 'Principal/Admin',
          include_attendance: true
        }
      }
    });
  } catch (error) {
    console.error('Error generating PDF data:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF data' },
      { status: 500 }
    );
  }
}

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

    // Count students for this exam/class/section
    const { count: studentCount } = await supabase
      .from('exam_results')
      .select('*', { count: 'exact', head: true })
      .eq('examination_id', examination_id)
      .eq('class_id', class_id);

    if (section_id) {
      const { count: sectionCount } = await supabase
        .from('exam_results')
        .select('*', { count: 'exact', head: true })
        .eq('examination_id', examination_id)
        .eq('class_id', class_id)
        .eq('section_id', section_id);
      
      // Note: We'll use the query below to get actual count
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
