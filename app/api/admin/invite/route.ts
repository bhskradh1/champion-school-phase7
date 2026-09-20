import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSiteUrl } from '@/lib/site-url';

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { data: actor } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (actor?.role !== 'admin' || !actor.is_active) {
    return NextResponse.json({ error: 'Admin permission required.' }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { email?: string; full_name?: string; role?: 'teacher'|'student'|'admin' } | null;
  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.full_name?.trim();
  const role = body?.role || 'teacher';
  if (!email || !fullName || !['teacher','student','admin'].includes(role)) {
    return NextResponse.json({ error: 'Name, email and a valid role are required.' }, { status: 400 });
  }

  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    // The link in the email opens the "Create your account" page of THIS website.
    redirectTo: `${getSiteUrl(request)}/signup`
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data.user) {
    await admin.from('profiles').update({ full_name: fullName, email, role }).eq('id', data.user.id);
  }
  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
