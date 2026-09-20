import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

/*
 * DELETE /api/admin/users   body: { user_id }
 *
 * Lets an ADMIN permanently delete a teacher or a student account
 * (login + profile + everything that belongs only to that person, such as a
 * student's attendance, submissions and results).
 *
 * Safety rules:
 *  - only active admins can call it
 *  - you cannot delete yourself
 *  - admin accounts cannot be deleted here
 *  - if the person has records the school must keep (exams they created,
 *    announcements they posted, attendance they marked...) the database refuses,
 *    and we tell the admin to DEACTIVATE the account instead.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const { data: actor } = await supabase
    .from('profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .single();

  if (actor?.role !== 'admin' || !actor.is_active) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as { user_id?: string } | null;
  const userId = String(body?.user_id || '');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required.' }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const service = createSupabaseAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: target } = await service
    .from('profiles')
    .select('id,role,full_name')
    .eq('id', userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: 'That account was not found.' }, { status: 404 });
  }

  if (target.role !== 'teacher' && target.role !== 'student') {
    return NextResponse.json(
      { error: 'Only teacher and student accounts can be deleted here.' },
      { status: 403 }
    );
  }

  const { error } = await service.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json(
      {
        error:
          `${target.full_name} has school records linked to this account (for example exams, announcements or attendance entered by them), ` +
          'so it cannot be permanently deleted. Use "Deactivate" instead: they will no longer be able to work in the system, and the records stay safe.',
        details: error.message,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
