-- Champion English School | Phase 5 discussions + replies + polls
-- Run after 005_assignments.sql.

create type public.discussion_audience as enum ('school','class');
create type public.discussion_kind as enum ('thread','poll');

create table public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  audience public.discussion_audience not null default 'school',
  class_id uuid references public.classes(id) on delete cascade,
  section_id uuid references public.sections(id) on delete cascade,
  kind public.discussion_kind not null default 'thread',
  title text not null check (char_length(trim(title)) between 2 and 180),
  body text not null default '' check (char_length(body) <= 10000),
  created_day date not null default ((now() at time zone 'Asia/Kathmandu')::date),
  is_locked boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discussion_audience_scope check (
    (audience = 'school' and class_id is null and section_id is null)
    or
    (audience = 'class' and class_id is not null)
  ),
  constraint discussion_section_needs_class check (section_id is null or class_id is not null)
);

-- Product rule: one top-level thread/poll per person per Nepal calendar day.
create unique index uq_one_discussion_per_person_per_day
  on public.discussion_threads(author_id, created_day);

create index idx_discussion_threads_feed on public.discussion_threads(audience, class_id, section_id, created_at desc);
create index idx_discussion_threads_author on public.discussion_threads(author_id, created_at desc);

create table public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_discussion_replies_thread on public.discussion_replies(thread_id, created_at);
create index idx_discussion_replies_author on public.discussion_replies(author_id, created_at desc);

create table public.discussion_poll_options (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  position smallint not null check (position >= 0),
  unique(thread_id, position)
);
create index idx_poll_options_thread on public.discussion_poll_options(thread_id, position);

create table public.discussion_poll_votes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  option_id uuid not null references public.discussion_poll_options(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(thread_id, voter_id)
);
create index idx_poll_votes_option on public.discussion_poll_votes(option_id);

create trigger discussion_threads_set_updated_at before update on public.discussion_threads
for each row execute procedure public.set_updated_at();
create trigger discussion_replies_set_updated_at before update on public.discussion_replies
for each row execute procedure public.set_updated_at();

alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.discussion_poll_options enable row level security;
alter table public.discussion_poll_votes enable row level security;

create or replace function public.can_access_discussion_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.discussion_threads t
    where t.id=p_thread_id and t.is_deleted=false and (
      public.is_admin()
      or t.author_id=auth.uid()
      or t.audience='school'
      or (
        t.audience='class' and (
          exists(select 1 from public.student_enrollments se where se.student_id=auth.uid() and se.is_active and se.class_id=t.class_id and (t.section_id is null or se.section_id=t.section_id))
          or exists(select 1 from public.teacher_assignments ta where ta.teacher_id=auth.uid() and ta.class_id=t.class_id and (ta.section_id is null or t.section_id is null or ta.section_id=t.section_id))
        )
      )
    )
  );
$$;

create or replace function public.can_post_to_discussion_scope(p_audience public.discussion_audience, p_class_id uuid, p_section_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or (
    p_audience='school'
    and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('student','teacher'))
  ) or (
    p_audience='class' and p_class_id is not null and (
      exists(select 1 from public.student_enrollments se where se.student_id=auth.uid() and se.is_active and se.class_id=p_class_id and (p_section_id is null or se.section_id=p_section_id))
      or exists(select 1 from public.teacher_assignments ta where ta.teacher_id=auth.uid() and ta.class_id=p_class_id and (p_section_id is null or ta.section_id is null or ta.section_id=p_section_id))
    )
  );
$$;


create policy "discussion threads readable by scope" on public.discussion_threads
for select to authenticated using (public.can_access_discussion_thread(id));

create policy "discussion threads insert scoped" on public.discussion_threads
for insert to authenticated with check (
  author_id=auth.uid()
  and public.can_post_to_discussion_scope(audience,class_id,section_id)
);

create policy "discussion threads update own or admin" on public.discussion_threads
for update to authenticated using (public.is_admin() or author_id=auth.uid())
with check (public.is_admin() or author_id=auth.uid());

create policy "discussion threads delete own or admin" on public.discussion_threads
for delete to authenticated using (public.is_admin() or author_id=auth.uid());

create policy "discussion replies readable by scope" on public.discussion_replies
for select to authenticated using (public.can_access_discussion_thread(thread_id));

create policy "discussion replies insert scoped" on public.discussion_replies
for insert to authenticated with check (author_id=auth.uid() and public.can_access_discussion_thread(thread_id));

create policy "discussion replies update own or admin" on public.discussion_replies
for update to authenticated using (public.is_admin() or author_id=auth.uid())
with check (public.is_admin() or author_id=auth.uid());

create policy "discussion replies delete own or admin" on public.discussion_replies
for delete to authenticated using (public.is_admin() or author_id=auth.uid());

create policy "poll options readable by scope" on public.discussion_poll_options
for select to authenticated using (public.can_access_discussion_thread(thread_id));

create policy "poll options creator or admin insert" on public.discussion_poll_options
for insert to authenticated with check (
  exists(select 1 from public.discussion_threads t where t.id=thread_id and (public.is_admin() or t.author_id=auth.uid()) and t.kind='poll')
);

create policy "poll options creator or admin update" on public.discussion_poll_options
for update to authenticated using (
  public.is_admin() or exists(select 1 from public.discussion_threads t where t.id=thread_id and t.author_id=auth.uid())
) with check (
  public.is_admin() or exists(select 1 from public.discussion_threads t where t.id=thread_id and t.author_id=auth.uid())
);

create policy "poll options creator or admin delete" on public.discussion_poll_options
for delete to authenticated using (
  public.is_admin() or exists(select 1 from public.discussion_threads t where t.id=thread_id and t.author_id=auth.uid())
);

create policy "poll votes readable by scope" on public.discussion_poll_votes
for select to authenticated using (public.can_access_discussion_thread(thread_id));

create policy "poll votes own insert" on public.discussion_poll_votes
for insert to authenticated with check (
  voter_id=auth.uid()
  and public.can_access_discussion_thread(thread_id)
  and exists(select 1 from public.discussion_threads t where t.id=thread_id and t.kind='poll' and not t.is_locked)
  and exists(select 1 from public.discussion_poll_options o where o.id=option_id and o.thread_id=thread_id)
);

create policy "poll votes own delete" on public.discussion_poll_votes
for delete to authenticated using (public.is_admin() or voter_id=auth.uid());

-- Atomic voting prevents a client from voting for an option belonging to another poll.
create or replace function public.vote_discussion_poll(p_thread_id uuid, p_option_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_access_discussion_thread(p_thread_id) then raise exception 'Not authorized to vote in this discussion'; end if;
  if not exists(select 1 from public.discussion_threads where id=p_thread_id and kind='poll' and not is_locked and not is_deleted) then raise exception 'Poll is closed or not found'; end if;
  if not exists(select 1 from public.discussion_poll_options where id=p_option_id and thread_id=p_thread_id) then raise exception 'Poll option does not belong to this poll'; end if;
  insert into public.discussion_poll_votes(thread_id,option_id,voter_id) values(p_thread_id,p_option_id,auth.uid())
  on conflict (thread_id,voter_id) do update set option_id=excluded.option_id, created_at=now();
end;
$$;
grant execute on function public.vote_discussion_poll(uuid,uuid) to authenticated;

create or replace function public.create_discussion_poll(
  p_audience public.discussion_audience,
  p_class_id uuid,
  p_section_id uuid,
  p_title text,
  p_body text,
  p_options text[]
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  t_id uuid;
  opt text;
  i integer := 0;
begin
  if not public.can_post_to_discussion_scope(p_audience,p_class_id,p_section_id) then raise exception 'Not authorized for this discussion scope'; end if;
  if coalesce(array_length(p_options,1),0) < 2 or array_length(p_options,1) > 10 then raise exception 'A poll needs between 2 and 10 options'; end if;
  insert into public.discussion_threads(author_id,audience,class_id,section_id,kind,title,body)
  values(auth.uid(),p_audience,p_class_id,p_section_id,'poll',trim(p_title),coalesce(p_body,'')) returning id into t_id;
  foreach opt in array p_options loop
    if char_length(trim(opt)) > 0 then
      insert into public.discussion_poll_options(thread_id,label,position) values(t_id,trim(opt),i);
      i := i + 1;
    end if;
  end loop;
  if i < 2 then raise exception 'A poll needs at least two non-empty options'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'discussion_poll_created','discussion_thread',t_id,jsonb_build_object('audience',p_audience,'class_id',p_class_id,'section_id',p_section_id));
  return t_id;
end;
$$;
grant execute on function public.create_discussion_poll(public.discussion_audience,uuid,uuid,text,text,text[]) to authenticated;

create or replace function public.audit_discussion_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(), case when TG_OP='INSERT' then 'discussion_created' when TG_OP='UPDATE' then 'discussion_updated' else 'discussion_deleted' end,
    'discussion_thread',coalesce(new.id,old.id),jsonb_build_object('kind',coalesce(new.kind,old.kind),'audience',coalesce(new.audience,old.audience),'operation',TG_OP));
  return coalesce(new,old);
end;
$$;
create trigger audit_discussion_changes after insert or update or delete on public.discussion_threads
for each row execute procedure public.audit_discussion_change();
