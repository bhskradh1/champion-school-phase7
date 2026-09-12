-- Champion English School | Phase 1 database foundation
-- Run in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create type public.app_role as enum ('student','teacher','admin');
create type public.request_status as enum ('pending','approved','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role public.app_role not null default 'student',
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_year_dates check (ends_on > starts_on)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  grade smallint not null check (grade between 1 and 12),
  name text not null,
  created_at timestamptz not null default now(),
  unique (academic_year_id, grade)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  room text,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  section_id uuid references public.sections(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  is_class_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_id, section_id, subject_id)
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  admission_no text,
  roll_no integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(student_id, academic_year_id)
);

create table public.student_approval_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  requested_class uuid not null references public.classes(id) on delete restrict,
  requested_section uuid not null references public.sections(id) on delete restrict,
  status public.request_status not null default 'pending',
  reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_enrollments_class_section on public.student_enrollments(class_id, section_id);
create index idx_teacher_assignments_teacher on public.teacher_assignments(teacher_id);
create index idx_approval_requests_status on public.student_approval_requests(status, requested_class, requested_section);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('teacher','admin') and is_active);
$$;

create or replace function public.is_class_teacher_for(p_class_id uuid, p_section_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.class_id = p_class_id
      and (ta.section_id is null or ta.section_id = p_section_id)
      and ta.is_class_teacher = true
  );
$$;

create or replace function public.approve_student_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.student_approval_requests;
begin
  select * into r from public.student_approval_requests where id = p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is no longer pending'; end if;
  if not public.is_class_teacher_for(r.requested_class, r.requested_section) then raise exception 'Not authorized for this class and section'; end if;

  update public.student_approval_requests set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where id=p_request_id;
  insert into public.student_enrollments(student_id,class_id,section_id,academic_year_id)
    values(r.student_id,r.requested_class,r.requested_section,r.academic_year_id)
    on conflict (student_id, academic_year_id) do update set class_id=excluded.class_id, section_id=excluded.section_id, is_active=true;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'student_approved','student_approval_request',p_request_id,jsonb_build_object('class_id',r.requested_class,'section_id',r.requested_section));
end;
$$;

create or replace function public.reject_student_request(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.student_approval_requests;
begin
  select * into r from public.student_approval_requests where id=p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is no longer pending'; end if;
  if not public.is_class_teacher_for(r.requested_class, r.requested_section) then raise exception 'Not authorized for this class and section'; end if;
  update public.student_approval_requests set status='rejected', reason=p_reason, reviewed_by=auth.uid(), reviewed_at=now() where id=p_request_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'student_rejected','student_approval_request',p_request_id,jsonb_build_object('reason',p_reason));
end;
$$;

grant execute on function public.approve_student_request(uuid) to authenticated;
grant execute on function public.reject_student_request(uuid,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.student_approval_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self or admin" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "profiles update self or admin" on public.profiles for update to authenticated using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
create policy "academic years readable" on public.academic_years for select to authenticated using (true);
create policy "academic years admin write" on public.academic_years for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "classes readable" on public.classes for select to authenticated using (true);
create policy "classes admin write" on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sections readable" on public.sections for select to authenticated using (true);
create policy "sections admin write" on public.sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "subjects readable" on public.subjects for select to authenticated using (true);
create policy "subjects admin write" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "assignments teacher scoped read" on public.teacher_assignments for select to authenticated using (teacher_id=auth.uid() or public.is_admin());
create policy "assignments admin write" on public.teacher_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "enrollments self teacher or admin read" on public.student_enrollments for select to authenticated using (student_id=auth.uid() or public.is_admin() or exists(select 1 from public.teacher_assignments ta where ta.teacher_id=auth.uid() and ta.class_id=student_enrollments.class_id));
create policy "enrollments admin write" on public.student_enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "approval requests scoped read" on public.student_approval_requests for select to authenticated using (student_id=auth.uid() or public.is_admin() or public.is_class_teacher_for(requested_class,requested_section));
create policy "students create own approval" on public.student_approval_requests for insert to authenticated with check (student_id=auth.uid());
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.is_admin());

-- New auth users get a basic profile. Role defaults to student; promote staff only through admin tooling.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email) values(new.id, coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.academic_years(name,starts_on,ends_on,is_current)
values ('2083 BS / 2026-27', '2026-04-14','2027-04-13',true)
on conflict (name) do nothing;
