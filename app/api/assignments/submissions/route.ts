import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/assignments/submissions
 * Get all submissions for an assignment (teacher view) or student's own submissions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const assignmentId = searchParams.get('assignment_id');
    const studentId = searchParams.get('student_id');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Get user role
    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!me) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get assignment details
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select('*, classes(name), sections(name), subjects(name)')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignError || !assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Permission check
    let canViewAll = false;
    if (me.role === 'admin') {
      canViewAll = true;
    } else if (me.role === 'teacher') {
      // Check if teacher is assigned to this class/subject
      const { data: isAssigned } = await supabase.rpc('can_manage_exam_scope', {
        p_class_id: assignment.class_id,
        p_section_id: assignment.section_id,
        p_subject_id: assignment.subject_id
      });
      canViewAll = !!isAssigned;
    }

    let query = supabase
      .from('assignment_submissions')
      .select(`
        *,
        profiles!assignment_submissions_student_id_fkey(full_name, student_code),
        assignment_submission_files(*)
      `)
      .eq('assignment_id', assignmentId);

    if (!canViewAll) {
      // Student can only see their own submissions
      query = query.eq('student_id', user.id);
    } else if (studentId && me.role !== 'student') {
      // Teacher can filter by specific student
      query = query.eq('student_id', studentId);
    }

    const { data: submissions, error } = await query.order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submissions || [],
      assignment
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assignments/submissions
 * Create a new submission or update existing one
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
    const { assignment_id, text_response, files } = body;

    if (!assignment_id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Get user role and profile
    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!me || me.role !== 'student') {
      return NextResponse.json(
        { error: 'Only students can submit assignments' },
        { status: 403 }
      );
    }

    // Get assignment details
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignment_id)
      .maybeSingle();

    if (assignError || !assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Check if student is in the correct class/section
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('id')
      .eq('student_id', user.id)
      .eq('class_id', assignment.class_id)
      .eq('section_id', assignment.section_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json(
        { error: 'You are not enrolled in this class' },
        { status: 403 }
      );
    }

    // Check deadline
    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    
    if (dueDate && now > dueDate) {
      if (!assignment.allow_late_submission) {
        return NextResponse.json(
          { error: 'Submission deadline has passed' },
          { status: 400 }
        );
      }
      // Late submission - could apply penalty here
    }

    // Check if submission already exists
    const { data: existingSubmission } = await supabase
      .from('assignment_submissions')
      .select('id')
      .eq('assignment_id', assignment_id)
      .eq('student_id', user.id)
      .maybeSingle();

    let submissionId: string;

    if (existingSubmission) {
      // Update existing submission
      submissionId = existingSubmission.id;
      
      const { error: updateError } = await supabase
        .from('assignment_submissions')
        .update({
          text_response: text_response || null,
          submitted_at: now.toISOString(),
          status: 'submitted'
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating submission:', updateError);
        return NextResponse.json(
          { error: 'Failed to update submission' },
          { status: 500 }
        );
      }
    } else {
      // Create new submission
      const { data: newSubmission, error: insertError } = await supabase
        .from('assignment_submissions')
        .insert({
          assignment_id,
          student_id: user.id,
          enrollment_id: enrollment.id,
          text_response: text_response || null,
          submitted_at: now.toISOString(),
          status: 'submitted'
        })
        .select()
        .single();

      if (insertError || !newSubmission) {
        console.error('Error creating submission:', insertError);
        return NextResponse.json(
          { error: 'Failed to create submission' },
          { status: 500 }
        );
      }

      submissionId = newSubmission.id;
    }

    // Handle file uploads (files should be pre-uploaded to storage, just link them here)
    if (files && Array.isArray(files) && files.length > 0) {
      const fileRecords = files.map((file: any) => ({
        submission_id: submissionId,
        file_name: file.name,
        file_url: file.url,
        mime_type: file.mime_type,
        file_size: file.size,
        uploaded_by: user.id
      }));

      const { error: fileError } = await supabase
        .from('assignment_submission_files')
        .insert(fileRecords);

      if (fileError) {
        console.error('Error linking files:', fileError);
        // Don't fail the whole submission, just log the error
      }
    }

    // Log submission history
    await supabase.from('assignment_submission_history').insert({
      submission_id: submissionId,
      action: existingSubmission ? 'updated' : 'submitted',
      actor_id: user.id,
      new_data: { text_response, files_count: files?.length || 0 }
    });

    // Create notification for teacher
    const { data: assignmentWithDetails } = await supabase
      .from('assignments')
      .select('teacher_id, title')
      .eq('id', assignment_id)
      .maybeSingle();

    if (assignmentWithDetails?.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: assignmentWithDetails.teacher_id,
        title: 'New Assignment Submission',
        message: `${me.full_name || 'A student'} submitted "${assignmentWithDetails.title}"`,
        type: 'ASSIGNMENT_SUBMISSION',
        reference_id: submissionId
      });
    }

    return NextResponse.json({
      success: true,
      data: { submission_id: submissionId },
      message: 'Assignment submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    return NextResponse.json(
      { error: 'Failed to submit assignment' },
      { status: 500 }
    );
  }
}

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

    // Notify student about grading
    await supabase.from('notifications').insert({
      user_id: submission.student_id,
      title: 'Assignment Graded',
      message: `Your submission for "${submission.assignments.title}" has been graded${grade !== undefined ? `: ${grade}/${max_marks || submission.assignments.max_marks || 100}` : ''}`,
      type: 'ASSIGNMENT_GRADED',
      reference_id: submissionId
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
