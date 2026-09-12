-- Champion English School | Phase 1.1 admin management hardening
-- Run after 001_initial.sql.

create unique index if not exists uq_class_teacher_per_section
  on public.teacher_assignments(class_id, section_id)
  where is_class_teacher = true and section_id is not null;

create unique index if not exists uq_class_teacher_whole_class
  on public.teacher_assignments(class_id)
  where is_class_teacher = true and section_id is null;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

-- Admins may create/update staff profile records once the auth account exists.
create policy "profiles admin insert" on public.profiles
  for insert to authenticated
  with check (public.is_admin());

-- Teachers can see the students in classes they are assigned to; students can see their own.
create policy "student profiles teacher scoped read" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      role = 'student' and exists (
        select 1 from public.student_enrollments se
        join public.teacher_assignments ta on ta.class_id = se.class_id
        where se.student_id = profiles.id and ta.teacher_id = auth.uid()
      )
    )
  );
