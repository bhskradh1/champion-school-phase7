import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getSiteUrl } from '@/lib/site-url';

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, error: 'Supabase is not configured.' } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: 'You must be signed in.' } as const;
  const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { supabase, error: 'Admin access required.' } as const;
  }
  return { supabase, user, error: null } as const;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await request.json();
  const name = String(body.full_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim() || null;
  const classId = String(body.class_id || '');
  const sectionId = String(body.section_id || '');
  const academicYearId = String(body.academic_year_id || '');
  const admissionNo = String(body.admission_no || '').trim() || null;
  const rollNo = body.roll_no === '' || body.roll_no == null ? null : Number(body.roll_no);

  if (!name || !email || !classId || !sectionId || !academicYearId) {
    return NextResponse.json({ error: 'Name, email, academic year, class and section are required.' }, { status: 400 });
  }
  if (rollNo !== null && (!Number.isInteger(rollNo) || rollNo < 0)) {
    return NextResponse.json({ error: 'Roll number must be a non-negative whole number.' }, { status: 400 });
  }

  const service = adminClient();
  if (!service) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for student invitations.' }, { status: 500 });
  }

  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name, role: 'student' },
    // The link in the email opens the "Create your account" page of THIS website.
    redirectTo: `${getSiteUrl(request)}/signup`
  });
  if (inviteError || !invited.user) {
    return NextResponse.json({ error: inviteError?.message || 'Could not create the student account. The email may already be registered.' }, { status: 400 });
  }

  const studentId = invited.user.id;
  const { error: profileError } = await auth.supabase!.from('profiles')
    .update({ full_name: name, email, phone, role: 'student', is_active: true })
    .eq('id', studentId);

  if (profileError) {
    await service.auth.admin.deleteUser(studentId);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: enrollmentId, error: enrollmentError } = await auth.supabase!.rpc('admin_upsert_student_enrollment', {
    p_student_id: studentId,
    p_class_id: classId,
    p_section_id: sectionId,
    p_academic_year_id: academicYearId,
    p_admission_no: admissionNo,
    p_roll_no: rollNo,
    p_is_active: true
  });

  if (enrollmentError) {
    await service.auth.admin.deleteUser(studentId);
    return NextResponse.json({ error: enrollmentError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, student_id: studentId, enrollment_id: enrollmentId });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await request.json();
  const studentId = String(body.student_id || '');
  const name = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim() || null;
  const isActive = Boolean(body.is_active);
  const classId = String(body.class_id || '');
  const sectionId = String(body.section_id || '');
  const academicYearId = String(body.academic_year_id || '');
  const admissionNo = String(body.admission_no || '').trim() || null;
  const rollNo = body.roll_no === '' || body.roll_no == null ? null : Number(body.roll_no);

  if (!studentId || !name || !classId || !sectionId || !academicYearId) {
    return NextResponse.json({ error: 'Student, name, academic year, class and section are required.' }, { status: 400 });
  }
  if (rollNo !== null && (!Number.isInteger(rollNo) || rollNo < 0)) {
    return NextResponse.json({ error: 'Roll number must be a non-negative whole number.' }, { status: 400 });
  }

  const { error: profileError } = await auth.supabase!.from('profiles')
    .update({ full_name: name, phone, is_active: isActive })
    .eq('id', studentId)
    .eq('role', 'student');
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  const { error: enrollmentError } = await auth.supabase!.rpc('admin_upsert_student_enrollment', {
    p_student_id: studentId,
    p_class_id: classId,
    p_section_id: sectionId,
    p_academic_year_id: academicYearId,
    p_admission_no: admissionNo,
    p_roll_no: rollNo,
    p_is_active: isActive
  });
  if (enrollmentError) return NextResponse.json({ error: enrollmentError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
