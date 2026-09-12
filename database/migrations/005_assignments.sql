-- Champion English School | Phase 4 assignments + submissions
-- Run after 004_attendance.sql.

create type public.assignment_status as enum ('draft','published','closed');
create type public.submission_status as enum ('draft','submitted','graded','late');

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  section_id uuid references public.sections(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  due_at timestamptz,
  max_points numeric(7,2) not null default 100 check (max_points > 0),
  status public.assignment_status not null default 'published',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  attachment_url text,
  status public.submission_status not null default 'draft',
  submitted_at timestamptz,
  grade numeric(7,2),
  feedback text,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id, student_id),
  constraint grade_nonnegative check (grade is null or grade >= 0)
);

create index idx_assignments_scope on public.assignments(class_id, section_id, due_at);
create index idx_assignments_teacher on public.assignments(teacher_id, created_at desc);
create index idx_assignments_subject on public.assignments(subject_id, created_at desc);
create index idx_submissions_assignment on public.assignment_submissions(assignment_id, status);
create index idx_submissions_student on public.assignment_submissions(student_id, updated_at desc);

create trigger assignments_set_updated_at before update on public.assignments
for each row execute procedure public.set_updated_at();
create trigger assignment_submissions_set_updated_at before update on public.assignment_submissions
for each row execute procedure public.set_updated_at();

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

-- A teacher can create an assignment only for a class/section + subject they teach.
create policy "assignments teacher insert scoped" on public.assignments
for insert to authenticated
with check (
  public.is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.class_id = assignments.class_id
      and ta.subject_id = assignments.subject_id
      and (ta.section_id is null or ta.section_id = assignments.section_id)
  )
);

create policy "assignments scoped read" on public.assignments
for select to authenticated using (
  public.is_admin()
  or teacher_id = auth.uid()
  or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.class_id = assignments.class_id
      and ta.subject_id = assignments.subject_id
      and (ta.section_id is null or ta.section_id = assignments.section_id)
  )
  or (
    status = 'published' and exists (
      select 1 from public.student_enrollments se
      where se.student_id = auth.uid()
        and se.is_active = true
        and se.class_id = assignments.class_id
        and (assignments.section_id is null or se.section_id = assignments.section_id)
    )
  )
);

create policy "assignments teacher update scoped" on public.assignments
for update to authenticated using (
  public.is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.class_id = assignments.class_id
      and ta.subject_id = assignments.subject_id
      and (ta.section_id is null or ta.section_id = assignments.section_id)
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.class_id = assignments.class_id
      and ta.subject_id = assignments.subject_id
      and (ta.section_id is null or ta.section_id = assignments.section_id)
  )
);

create policy "assignments teacher delete scoped" on public.assignments
for delete to authenticated using (
  public.is_admin() or teacher_id = auth.uid()
);

create policy "submissions student or teacher read" on public.assignment_submissions
for select to authenticated using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.assignments a
    join public.teacher_assignments ta on ta.teacher_id = auth.uid()
      and ta.class_id = a.class_id
      and ta.subject_id = a.subject_id
      and (ta.section_id is null or ta.section_id = a.section_id)
    where a.id = assignment_submissions.assignment_id
  )
);

create policy "submissions student insert" on public.assignment_submissions
for insert to authenticated with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.assignments a
    join public.student_enrollments se on se.student_id = auth.uid()
      and se.class_id = a.class_id
      and se.is_active = true
      and (a.section_id is null or se.section_id = a.section_id)
    where a.id = assignment_submissions.assignment_id
      and a.status = 'published'
  )
);

create policy "submissions student update" on public.assignment_submissions
for update to authenticated using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.assignments a
    join public.teacher_assignments ta on ta.teacher_id = auth.uid()
      and ta.class_id = a.class_id
      and ta.subject_id = a.subject_id
      and (ta.section_id is null or ta.section_id = a.section_id)
    where a.id = assignment_submissions.assignment_id
  )
) with check (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.assignments a
    join public.teacher_assignments ta on ta.teacher_id = auth.uid()
      and ta.class_id = a.class_id
      and ta.subject_id = a.subject_id
      and (ta.section_id is null or ta.section_id = a.section_id)
    where a.id = assignment_submissions.assignment_id
  )
);

create policy "submissions teacher delete" on public.assignment_submissions
for delete to authenticated using (public.is_admin() or student_id = auth.uid());

-- Guardrails for direct submission updates: students cannot grade themselves.
create or replace function public.guard_assignment_submission()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() and new.student_id = auth.uid() then
    if new.grade is distinct from old.grade
       or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by
       or new.graded_at is distinct from old.graded_at
       or new.status = 'graded' then
      raise exception 'Students cannot grade their own submissions';
    end if;
  end if;
  if new.submitted_at is null and new.status in ('submitted','late') then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;
create trigger guard_assignment_submission before update on public.assignment_submissions
for each row execute procedure public.guard_assignment_submission();

-- Secure grading RPC: teacher must teach the assignment's subject/scope.
create or replace function public.grade_assignment_submission(
  p_submission_id uuid,
  p_grade numeric,
  p_feedback text
)
returns void language plpgsql security definer set search_path=public as $$
declare
  s public.assignment_submissions;
  a public.assignments;
begin
  select * into s from public.assignment_submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into a from public.assignments where id=s.assignment_id;
  if not found then raise exception 'Assignment not found'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id=auth.uid() and ta.class_id=a.class_id and ta.subject_id=a.subject_id
      and (ta.section_id is null or ta.section_id=a.section_id)
  ) then raise exception 'Not authorized to grade this assignment'; end if;
  if p_grade < 0 or p_grade > a.max_points then raise exception 'Grade must be between 0 and the assignment maximum'; end if;
  update public.assignment_submissions set grade=p_grade, feedback=nullif(trim(p_feedback),''), status='graded', graded_by=auth.uid(), graded_at=now(), updated_at=now() where id=p_submission_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'assignment_graded','assignment_submission',p_submission_id,jsonb_build_object('grade',p_grade,'assignment_id',a.id));
end;
$$;
grant execute on function public.grade_assignment_submission(uuid,numeric,text) to authenticated;

-- Audit teacher-created assignments and admin actions through a trigger.
create or replace function public.audit_assignment_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(), case when TG_OP='INSERT' then 'assignment_created' when TG_OP='UPDATE' then 'assignment_updated' else 'assignment_deleted' end,
         'assignment', coalesce(new.id,old.id), jsonb_build_object('class_id',coalesce(new.class_id,old.class_id),'subject_id',coalesce(new.subject_id,old.subject_id),'operation',TG_OP));
  return coalesce(new,old);
end;
$$;
create trigger audit_assignment_changes after insert or update or delete on public.assignments
for each row execute procedure public.audit_assignment_change();
