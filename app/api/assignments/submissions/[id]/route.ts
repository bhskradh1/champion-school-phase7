import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/assignments/submissions/[id]
 * Grade a submission (teacher only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: submissionId } = await params;
    const body = await request.json();
    const { grade, feedback, max_marks } = body;

    // Get user role
    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!me || (me.role !== 'teacher' && me.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only teachers can grade submissions' },
        { status: 403 }
      );
    }

    // Get submission with assignment details
    const { data: submission, error: subError } = await supabase
      .from('assignment_submissions')
      .select(`
        *,
        assignments(class_id, section_id, subject_id, teacher_id, title)
      `)
      .eq('id', submissionId)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Verify teacher has access to this class/subject
    if (me.role === 'teacher') {
      const { data: isAssigned } = await supabase.rpc('can_manage_exam_scope', {
        p_class_id: submission.assignments.class_id,
        p_section_id: submission.assignments.section_id,
        p_subject_id: submission.assignments.subject_id
      });

      if (!isAssigned && submission.assignments.teacher_id !== user.id) {
        return NextResponse.json(
          { error: 'Not authorized to grade this submission' },
          { status: 403 }
        );
      }
    }

    // Validate grade
    if (grade !== undefined) {
      const gradeNum = Number(grade);
      const maxMarksNum = max_marks ? Number(max_marks) : Number(submission.assignments.max_marks || 100);

      if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > maxMarksNum) {
        return NextResponse.json(
          { error: `Grade must be between 0 and ${maxMarksNum}` },
          { status: 400 }
        );
      }
    }

    // Update submission
    const { error: updateError } = await supabase
      .from('assignment_submissions')
      .update({
        ...(grade !== undefined && { grade }),
        ...(max_marks !== undefined && { max_marks }),
        ...(feedback !== undefined && { feedback }),
        graded_at: new Date().toISOString(),
        graded_by: user.id
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error grading submission:', updateError);
      return NextResponse.json(
        { error: 'Failed to grade submission' },
        { status: 500 }
      );
    }

    // Log grading action
    await supabase.from('assignment_submission_history').insert({
      submission_id: submissionId,
      action: 'graded',
      actor_id: user.id,
      new_data: { grade, feedback }
    });

    return NextResponse.json({
      success: true,
      message: 'Submission graded successfully'
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    return NextResponse.json(
      { error: 'Failed to grade submission' },
      { status: 500 }
    );
  }
}
