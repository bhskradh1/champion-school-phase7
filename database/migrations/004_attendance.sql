-- Champion English School | Phase 3 attendance
-- Run after 001_initial.sql, 002_admin_management.sql and 003_student_management.sql.

create type public.attendance_status as enum ('present','absent','late','excused');

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  attendance_date date not null,
  status public.attendance_status not null default 'present',
  note text,
  marked_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, attendance_date)
);

create index idx_attendance_section_date on public.attendance_records(class_id, section_id, attendance_date);
create index idx_attendance_student_date on public.attendance_records(student_id, attendance_date desc);
create index idx_attendance_marked_by on public.attendance_records(marked_by, attendance_date desc);

create trigger attendance_set_updated_at before update on public.attendance_records
for each row execute procedure public.set_updated_at();

alter table public.attendance_records enable row level security;

-- Students see only their own attendance. Class teachers/admins see the
-- attendance in their authorized class/section scope.
create policy "attendance scoped read" on public.attendance_records
for select to authenticated using (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_class_teacher_for(class_id, section_id)
);

-- Direct writes are deliberately not allowed for teachers. Attendance is
-- written through the authorization-checked RPC below.

create or replace function public.save_class_attendance(
  p_class_id uuid,
  p_section_id uuid,
  p_attendance_date date,
  p_records jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_student_id uuid;
  v_status public.attendance_status;
  v_note text;
  v_count integer := 0;
begin
  if not public.is_class_teacher_for(p_class_id, p_section_id) then
    raise exception 'Only the class teacher or admin can record attendance';
  end if;

  if p_attendance_date > current_date then
    raise exception 'Attendance cannot be recorded for a future date';
  end if;

  if not exists (
    select 1 from public.sections s
    join public.classes c on c.id=s.class_id
    where s.id=p_section_id and s.class_id=p_class_id
  ) then
    raise exception 'Invalid class and section';
  end if;

  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'Attendance records must be an array';
  end if;

  for item in select * from jsonb_array_elements(p_records)
  loop
    v_student_id := (item->>'student_id')::uuid;
    v_status := (item->>'status')::public.attendance_status;
    v_note := nullif(trim(item->>'note'), '');

    if not exists (
      select 1 from public.student_enrollments se
      where se.student_id=v_student_id
        and se.class_id=p_class_id
        and se.section_id=p_section_id
        and se.is_active=true
    ) then
      raise exception 'Student is not an active member of this class and section';
    end if;

    insert into public.attendance_records
      (student_id,class_id,section_id,attendance_date,status,note,marked_by)
    values
      (v_student_id,p_class_id,p_section_id,p_attendance_date,v_status,v_note,auth.uid())
    on conflict (student_id, attendance_date)
    do update set
      class_id=excluded.class_id,
      section_id=excluded.section_id,
      status=excluded.status,
      note=excluded.note,
      marked_by=excluded.marked_by,
      updated_at=now();

    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs(actor_id,action,entity_type,metadata)
  values (
    auth.uid(),
    'attendance_saved',
    'attendance_record',
    jsonb_build_object('class_id',p_class_id,'section_id',p_section_id,'attendance_date',p_attendance_date,'record_count',v_count)
  );

  return v_count;
end;
$$;

grant execute on function public.save_class_attendance(uuid,uuid,date,jsonb) to authenticated;

-- Prevent students from changing their own attendance through normal UPDATE.
-- Only the RPC can write records because no INSERT/UPDATE policy is granted.
