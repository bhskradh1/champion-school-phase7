-- Champion English School | Phase 7 announcements and in-app notifications
-- Run after 007_examinations_results.sql.

create type public.announcement_audience as enum ('all', 'teachers');
create type public.notification_kind as enum ('announcement');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 2 and 5000),
  target_audience public.announcement_audience not null default 'all',
  is_published boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcement_expiry_valid check (expires_at is null or expires_at > created_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  kind public.notification_kind not null default 'announcement',
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_id, announcement_id)
);

create index idx_announcements_delivery on public.announcements(is_published, target_audience, published_at desc);
create index idx_notifications_recipient_state on public.notifications(recipient_id, read_at, created_at desc);
create trigger announcements_set_updated_at before update on public.announcements for each row execute procedure public.set_updated_at();

alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

create policy "announcements audience read" on public.announcements for select to authenticated using (
  public.is_admin() or (is_published and (expires_at is null or expires_at > now()) and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_active
  ) and (
    target_audience = 'all' or target_audience = 'teachers' and exists (
      select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.is_active
    )
  ))
);
create policy "announcements admin write" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "notifications recipient read" on public.notifications for select to authenticated using (
  recipient_id=auth.uid() and exists (
    select 1 from public.announcements a where a.id=announcement_id and a.is_published and (a.expires_at is null or a.expires_at > now())
  )
);

-- Delivery runs with database authority: recipients cannot be selected by a browser request.
create or replace function public.sync_announcement_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.is_published then
    insert into public.notifications(recipient_id, announcement_id, kind, title, body)
      select p.id, new.id, 'announcement', new.title, new.body
      from public.profiles p where p.is_active and (new.target_audience='all' or p.role='teacher')
    on conflict(recipient_id, announcement_id) do update set title=excluded.title, body=excluded.body;
    delete from public.notifications n where n.announcement_id=new.id and not exists (
      select 1 from public.profiles p where p.id=n.recipient_id and p.is_active and (new.target_audience='all' or p.role='teacher')
    );
  else
    delete from public.notifications where announcement_id=new.id;
  end if;
  return new;
end;
$$;
create trigger announcements_sync_notifications after insert or update of title, body, target_audience, is_published on public.announcements for each row execute procedure public.sync_announcement_notifications();

create or replace function public.audit_announcement_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (
    auth.uid(),
    case when TG_OP='INSERT' then 'announcement_created' when TG_OP='UPDATE' then
      case when new.is_published and not old.is_published then 'announcement_published' when not new.is_published and old.is_published then 'announcement_unpublished' else 'announcement_updated' end
      else 'announcement_deleted' end,
    'announcement',coalesce(new.id,old.id),
    jsonb_build_object('audience',coalesce(new.target_audience,old.target_audience),'published',coalesce(new.is_published,old.is_published))
  );
  return coalesce(new,old);
end;
$$;
create trigger announcements_audit_change after insert or update or delete on public.announcements for each row execute procedure public.audit_announcement_change();

-- Read state uses dedicated, recipient-checked RPCs; direct notification mutation is not allowed.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_id=auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end;
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update public.notifications n set read_at=now() where n.recipient_id=auth.uid() and n.read_at is null and exists(
    select 1 from public.announcements a where a.id=n.announcement_id and a.is_published and (a.expires_at is null or a.expires_at > now())
  );
  get diagnostics changed=row_count;
  return changed;
end;
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;
