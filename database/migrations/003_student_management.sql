-- Champion English School | Phase 2 student management
-- Run after 001_initial.sql and 002_admin_management.sql.

create index if not exists idx_profiles_role_active_name
  on public.profiles(role, is_active, full_name);

create index if not exists idx_enrollments_student_active
  on public.student_enrollments(student_id, is_active);


drop policy if exists "student profiles teacher scoped read" on public.profiles;
create policy "student profiles teacher scoped read" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      role = 'student' and exists (
        select 1
        from public.student_enrollments se
        join public.teacher_assignments ta
          on ta.class_id = se.class_id
         and (ta.section_id is null or ta.section_id = se.section_id)
        where se.student_id = profiles.id
          and ta.teacher_id = auth.uid()
      )
    )
  );

-- Students may read their own active enrollment; teachers may read enrollments
-- for classes/sections they teach. Admins retain full access.
drop policy if exists "enrollments self teacher or admin read" on public.student_enrollments;
create policy "enrollments self teacher or admin read" on public.student_enrollments
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.class_id = student_enrollments.class_id
        and (ta.section_id is null or ta.section_id = student_enrollments.section_id)
    )
  );

-- Admin-only profile and enrollment management is intentionally enforced at
-- database level; the UI is not the security boundary.
drop policy if exists "enrollments admin write" on public.student_enrollments;
create policy "enrollments admin write" on public.student_enrollments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.admin_upsert_student_enrollment(
  p_student_id uuid,
  p_class_id uuid,
  p_section_id uuid,
  p_academic_year_id uuid,
  p_admission_no text default null,
  p_roll_no integer default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_student_id and role = 'student'
  ) then
    raise exception 'Student profile not found';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.academic_year_id = p_academic_year_id
  ) then
    raise exception 'Class does not belong to the academic year';
  end if;

  if not exists (
    select 1 from public.sections s
    where s.id = p_section_id and s.class_id = p_class_id
  ) then
    raise exception 'Section does not belong to the selected class';
  end if;

  insert into public.student_enrollments
    (student_id, class_id, section_id, academic_year_id, admission_no, roll_no, is_active)
  values
    (p_student_id, p_class_id, p_section_id, p_academic_year_id, nullif(trim(p_admission_no), ''), p_roll_no, p_is_active)
  on conflict (student_id, academic_year_id)
  do update set
    class_id = excluded.class_id,
    section_id = excluded.section_id,
    admission_no = excluded.admission_no,
    roll_no = excluded.roll_no,
    is_active = excluded.is_active
  returning id into v_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'student_enrollment_upserted',
    'student_enrollment',
    v_id,
    jsonb_build_object(
      'student_id', p_student_id,
      'class_id', p_class_id,
      'section_id', p_section_id,
      'academic_year_id', p_academic_year_id
    )
  );

  return v_id;
end;
$$;

grant execute on function public.admin_upsert_student_enrollment(uuid,uuid,uuid,uuid,text,integer,boolean) to authenticated;

-- A student may submit one active request for a given academic year.
create unique index if not exists uq_pending_student_approval_per_year
  on public.student_approval_requests(student_id, academic_year_id)
  where status = 'pending';

-- Students can read their own approval history. Admins/class teachers can
-- read the requests already permitted by the base migration.
drop policy if exists "approval requests scoped read" on public.student_approval_requests;
create policy "approval requests scoped read" on public.student_approval_requests
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.is_class_teacher_for(requested_class, requested_section)
  );

-- Keep student creation self-service, but prevent a student from pretending
-- to create a request for another user.
drop policy if exists "students create own approval" on public.student_approval_requests;
create policy "students create own approval" on public.student_approval_requests
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
  );
