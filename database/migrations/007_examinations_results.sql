-- Champion English School | Phase 6 examinations, marks verification and results
-- Run after 006_discussions.sql.

create type public.exam_term as enum ('terminal','midterm','final');
create type public.exam_status as enum ('draft','open','locked','completed');
create type public.mark_status as enum ('draft','submitted','changes_requested','verified');

create table public.examinations (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term public.exam_term not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  starts_on date,
  ends_on date,
  marks_deadline timestamptz,
  status public.exam_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_year_id, term),
  constraint exam_dates_valid check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.exam_mark_sheets (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  status public.mark_status not null default 'draft',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(examination_id, class_id, section_id, subject_id)
);

create table public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  mark_sheet_id uuid not null references public.exam_mark_sheets(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrollment_id uuid not null references public.student_enrollments(id) on delete restrict,
  marks numeric(7,2),
  max_marks numeric(7,2) not null default 100 check (max_marks > 0),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mark_sheet_id, student_id),
  constraint marks_range check (marks is null or (marks >= 0 and marks <= max_marks))
);

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  total_marks numeric(9,2) not null default 0,
  total_max_marks numeric(9,2) not null default 0,
  percentage numeric(6,2) not null default 0,
  grade text,
  rank integer,
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(examination_id, student_id)
);

create table public.exam_result_items (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.exam_results(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  marks numeric(7,2) not null,
  max_marks numeric(7,2) not null,
  percentage numeric(6,2) not null,
  grade text,
  unique(result_id, subject_id)
);

create index idx_examinations_year on public.examinations(academic_year_id, starts_on desc);
create index idx_mark_sheets_exam_scope on public.exam_mark_sheets(examination_id, class_id, section_id, subject_id);
create index idx_mark_sheets_teacher on public.exam_mark_sheets(teacher_id, status);
create index idx_exam_marks_sheet on public.exam_marks(mark_sheet_id, student_id);
create index idx_exam_marks_student on public.exam_marks(student_id, examination_id);
create index idx_results_exam_scope on public.exam_results(examination_id, class_id, section_id, is_published);
create index idx_result_items_result on public.exam_result_items(result_id);

create trigger examinations_set_updated_at before update on public.examinations for each row execute procedure public.set_updated_at();
create trigger exam_mark_sheets_set_updated_at before update on public.exam_mark_sheets for each row execute procedure public.set_updated_at();
create trigger exam_marks_set_updated_at before update on public.exam_marks for each row execute procedure public.set_updated_at();
create trigger exam_results_set_updated_at before update on public.exam_results for each row execute procedure public.set_updated_at();

alter table public.examinations enable row level security;
alter table public.exam_mark_sheets enable row level security;
alter table public.exam_marks enable row level security;
alter table public.exam_results enable row level security;
alter table public.exam_result_items enable row level security;

create or replace function public.can_manage_exam_scope(p_class_id uuid, p_section_id uuid, p_subject_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id=auth.uid() and ta.class_id=p_class_id and ta.subject_id=p_subject_id
      and (ta.section_id is null or ta.section_id=p_section_id)
  );
$$;

create or replace function public.is_class_teacher_for_scope(p_class_id uuid, p_section_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id=auth.uid() and ta.class_id=p_class_id and ta.is_class_teacher
      and (ta.section_id is null or ta.section_id=p_section_id)
  );
$$;

create policy "exams readable authenticated" on public.examinations for select to authenticated using (
  public.is_admin() or exists(select 1 from public.exam_mark_sheets ms where ms.examination_id=id and (ms.teacher_id=auth.uid() or public.can_manage_exam_scope(ms.class_id,ms.section_id,ms.subject_id)))
  or exists(select 1 from public.exam_results r where r.examination_id=id and r.student_id=auth.uid() and r.is_published)
);
create policy "exams admin write" on public.examinations for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy "mark sheets scoped read" on public.exam_mark_sheets for select to authenticated using (
  public.is_admin() or teacher_id=auth.uid() or public.can_manage_exam_scope(class_id,section_id,subject_id)
);
create policy "mark sheets admin insert" on public.exam_mark_sheets for insert to authenticated with check(public.is_admin());
create policy "mark sheets teacher update" on public.exam_mark_sheets for update to authenticated using(
  public.is_admin() or public.can_manage_exam_scope(class_id,section_id,subject_id)
) with check(
  public.is_admin() or public.can_manage_exam_scope(class_id,section_id,subject_id)
);

create policy "exam marks scoped read" on public.exam_marks for select to authenticated using(
  public.is_admin() or student_id=auth.uid() or exists(select 1 from public.exam_mark_sheets ms where ms.id=mark_sheet_id and (ms.teacher_id=auth.uid() or public.can_manage_exam_scope(ms.class_id,ms.section_id,ms.subject_id)))
);
create policy "exam marks scoped insert" on public.exam_marks for insert to authenticated with check(
  public.is_admin() or exists(select 1 from public.exam_mark_sheets ms where ms.id=mark_sheet_id and public.can_manage_exam_scope(ms.class_id,ms.section_id,ms.subject_id))
);
create policy "exam marks scoped update" on public.exam_marks for update to authenticated using(
  public.is_admin() or exists(select 1 from public.exam_mark_sheets ms where ms.id=mark_sheet_id and public.can_manage_exam_scope(ms.class_id,ms.section_id,ms.subject_id))
) with check(
  public.is_admin() or exists(select 1 from public.exam_mark_sheets ms where ms.id=mark_sheet_id and public.can_manage_exam_scope(ms.class_id,ms.section_id,ms.subject_id))
);

create policy "results student published or staff" on public.exam_results for select to authenticated using(
  public.is_admin() or student_id=auth.uid() and is_published or public.is_class_teacher_for_scope(class_id,section_id)
);
create policy "results admin write" on public.exam_results for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy "result items scoped read" on public.exam_result_items for select to authenticated using(
  public.is_admin() or exists(select 1 from public.exam_results r where r.id=result_id and (r.student_id=auth.uid() and r.is_published or public.is_class_teacher_for_scope(r.class_id,r.section_id)))
);
create policy "result items admin write" on public.exam_result_items for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Admin creates a complete mark-entry matrix from current active enrollments and teaching assignments.
create or replace function public.open_exam_mark_entry(p_exam_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare
  e public.examinations;
  inserted_count integer := 0;
  ta record;
  ms_id uuid;
  en record;
begin
  if not public.is_admin() then raise exception 'Only admin can open mark entry'; end if;
  select * into e from public.examinations where id=p_exam_id for update;
  if not found then raise exception 'Examination not found'; end if;
  update public.examinations set status='open' where id=p_exam_id;
  for ta in select distinct on (ta.class_id, coalesce(ta.section_id,'00000000-0000-0000-0000-000000000000'::uuid), ta.subject_id)
      ta.class_id,ta.section_id,ta.subject_id,ta.teacher_id
    from public.teacher_assignments ta
    join public.classes c on c.id=ta.class_id and c.academic_year_id=e.academic_year_id
    where ta.subject_id is not null
    order by ta.class_id,coalesce(ta.section_id,'00000000-0000-0000-0000-000000000000'::uuid),ta.subject_id,ta.is_class_teacher desc,ta.teacher_id
  loop
    if ta.section_id is null then
      for en in select se.* from public.student_enrollments se where se.class_id=ta.class_id and se.is_active and se.academic_year_id=e.academic_year_id loop
        -- Whole-class teaching assignment is expanded into each enrolled section below.
        select id into ms_id from public.exam_mark_sheets where examination_id=p_exam_id and class_id=ta.class_id and section_id=en.section_id and subject_id=ta.subject_id;
        if ms_id is null then
          insert into public.exam_mark_sheets(examination_id,class_id,section_id,subject_id,teacher_id) values(p_exam_id,ta.class_id,en.section_id,ta.subject_id,ta.teacher_id) returning id into ms_id;
        end if;
        insert into public.exam_marks(mark_sheet_id,examination_id,student_id,enrollment_id,max_marks)
          values(ms_id,p_exam_id,en.student_id,en.id,100) on conflict do nothing;
        inserted_count := inserted_count + 1;
      end loop;
    else
      insert into public.exam_mark_sheets(examination_id,class_id,section_id,subject_id,teacher_id)
      values(p_exam_id,ta.class_id,ta.section_id,ta.subject_id,ta.teacher_id)
      on conflict(examination_id,class_id,section_id,subject_id) do update set teacher_id=excluded.teacher_id
      returning id into ms_id;
      insert into public.exam_marks(mark_sheet_id,examination_id,student_id,enrollment_id,max_marks)
        select ms_id,p_exam_id,se.student_id,se.id,100 from public.student_enrollments se
        where se.class_id=ta.class_id and se.section_id=ta.section_id and se.is_active and se.academic_year_id=e.academic_year_id
        on conflict do nothing;
      inserted_count := inserted_count + row_count;
    end if;
  end loop;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'exam_mark_entry_opened','examination',p_exam_id,jsonb_build_object('rows_created',inserted_count));
  return inserted_count;
end;
$$;
grant execute on function public.open_exam_mark_entry(uuid) to authenticated;

create or replace function public.submit_exam_mark_sheet(p_mark_sheet_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare ms public.exam_mark_sheets; e public.examinations; missing integer;
begin
  select * into ms from public.exam_mark_sheets where id=p_mark_sheet_id for update;
  if not found then raise exception 'Mark sheet not found'; end if;
  if not public.can_manage_exam_scope(ms.class_id,ms.section_id,ms.subject_id) then raise exception 'Not authorized to submit this mark sheet'; end if;
  select * into e from public.examinations where id=ms.examination_id;
  if e.status <> 'open' then raise exception 'Mark entry is not open'; end if;
  if e.marks_deadline is not null and now() > e.marks_deadline and not public.is_admin() then raise exception 'Mark submission deadline has passed'; end if;
  select count(*) into missing from public.exam_marks where mark_sheet_id=p_mark_sheet_id and marks is null;
  if missing > 0 then raise exception 'Enter all marks before submitting (% missing)', missing; end if;
  update public.exam_mark_sheets set status='submitted',submitted_at=now(),review_note=null where id=p_mark_sheet_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'exam_marks_submitted','exam_mark_sheet',p_mark_sheet_id,'{}');
end;
$$;
grant execute on function public.submit_exam_mark_sheet(uuid) to authenticated;

create or replace function public.review_exam_mark_sheet(p_mark_sheet_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare ms public.exam_mark_sheets;
begin
  if not public.is_admin() then raise exception 'Only admin can verify marks'; end if;
  select * into ms from public.exam_mark_sheets where id=p_mark_sheet_id for update;
  if not found then raise exception 'Mark sheet not found'; end if;
  if ms.status not in ('submitted','changes_requested') then raise exception 'This mark sheet is not awaiting verification'; end if;
  update public.exam_mark_sheets set status=case when p_approve then 'verified' else 'changes_requested' end,
    verified_at=case when p_approve then now() else null end,verified_by=case when p_approve then auth.uid() else null end,
    review_note=nullif(trim(p_note),'') where id=p_mark_sheet_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_approve then 'exam_marks_verified' else 'exam_marks_changes_requested' end,'exam_mark_sheet',p_mark_sheet_id,jsonb_build_object('note',p_note));
end;
$$;
grant execute on function public.review_exam_mark_sheet(uuid,boolean,text) to authenticated;

create or replace function public.generate_exam_results(p_exam_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare
  e public.examinations; r record; result_id uuid; count_rows integer := 0; item record; total numeric; max_total numeric; pct numeric; g text; rk integer;
begin
  if not public.is_admin() then raise exception 'Only admin can generate results'; end if;
  select * into e from public.examinations where id=p_exam_id for update;
  if not found then raise exception 'Examination not found'; end if;
  if exists(select 1 from public.exam_mark_sheets where examination_id=p_exam_id and status <> 'verified') then raise exception 'All mark sheets must be verified before results are generated'; end if;
  delete from public.exam_results where examination_id=p_exam_id;
  for r in select em.student_id, min(se.class_id) class_id, min(se.section_id) section_id,
      sum(coalesce(em.marks,0)) total_marks, sum(em.max_marks) total_max
    from public.exam_marks em join public.student_enrollments se on se.id=em.enrollment_id
    where em.examination_id=p_exam_id and se.is_active group by em.student_id loop
    total := coalesce(r.total_marks,0); max_total := nullif(r.total_max,0); pct := round(total*100/max_total,2);
    g := case when pct>=90 then 'A+' when pct>=80 then 'A' when pct>=70 then 'B+' when pct>=60 then 'B' when pct>=50 then 'C+' when pct>=40 then 'C' else 'F' end;
    insert into public.exam_results(examination_id,student_id,class_id,section_id,total_marks,total_max_marks,percentage,grade)
      values(p_exam_id,r.student_id,r.class_id,r.section_id,total,max_total,pct,g) returning id into result_id;
    for item in select em.subject_id,sum(coalesce(em.marks,0)) marks,sum(em.max_marks) max_marks from public.exam_marks em where em.examination_id=p_exam_id and em.student_id=r.student_id group by em.subject_id loop
      insert into public.exam_result_items(result_id,subject_id,marks,max_marks,percentage,grade)
      values(result_id,item.subject_id,item.marks,item.max_marks,round(item.marks*100/item.max_marks,2),case when item.marks*100/item.max_marks>=90 then 'A+' when item.marks*100/item.max_marks>=80 then 'A' when item.marks*100/item.max_marks>=70 then 'B+' when item.marks*100/item.max_marks>=60 then 'B' when item.marks*100/item.max_marks>=50 then 'C+' when item.marks*100/item.max_marks>=40 then 'C' else 'F' end);
    end loop;
    count_rows := count_rows + 1;
  end loop;
  -- Rank separately inside each class/section using percentage.
  for r in select id, dense_rank() over(partition by class_id,section_id order by percentage desc) rk from public.exam_results where examination_id=p_exam_id loop
    update public.exam_results set rank=r.rk where id=r.id;
  end loop;
  update public.examinations set status='completed' where id=p_exam_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'exam_results_generated','examination',p_exam_id,jsonb_build_object('students',count_rows));
  return count_rows;
end;
$$;
grant execute on function public.generate_exam_results(uuid) to authenticated;

create or replace function public.publish_exam_results(p_exam_id uuid,p_class_id uuid,p_section_id uuid,p_publish boolean)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if not public.is_class_teacher_for_scope(p_class_id,p_section_id) then raise exception 'Only the class teacher or admin can publish this class result'; end if;
  if not exists(select 1 from public.examinations where id=p_exam_id and status='completed') then raise exception 'Generate results first'; end if;
  update public.exam_results set is_published=p_publish,published_at=case when p_publish then now() else null end,published_by=case when p_publish then auth.uid() else null end where examination_id=p_exam_id and class_id=p_class_id and section_id=p_section_id;
  get diagnostics n=row_count;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_publish then 'exam_results_published' else 'exam_results_unpublished' end,'examination',p_exam_id,jsonb_build_object('class_id',p_class_id,'section_id',p_section_id,'rows',n));
  return n;
end;
$$;
grant execute on function public.publish_exam_results(uuid,uuid,uuid,boolean) to authenticated;

create or replace function public.audit_exam_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when TG_OP='INSERT' then 'examination_created' when TG_OP='UPDATE' then 'examination_updated' else 'examination_deleted' end,'examination',coalesce(new.id,old.id),jsonb_build_object('term',coalesce(new.term,old.term),'operation',TG_OP));
 return coalesce(new,old);
end; $$;
create trigger audit_exam_changes after insert or update or delete on public.examinations for each row execute procedure public.audit_exam_change();
