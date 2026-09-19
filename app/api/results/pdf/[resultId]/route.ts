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

      // Teachers must be the class teacher or teach a subject in this class
      if (me.role === 'teacher') {
        const { data: isClassTeacher } = await supabase.rpc(
          'is_class_teacher_for_scope',
          {
            p_class_id: result.class_id,
            p_section_id: result.section_id
          }
        );

        if (!isClassTeacher) {
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
