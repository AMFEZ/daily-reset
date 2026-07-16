-- Alpha 0.30 — Reminder Settings + Foreground Notifications
-- Cloud-syncs the four core Daily Reset reminder schedules.
-- Browser/PWA notification delivery is handled by the client runtime.

create table if not exists public.daily_reset_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null
    check (
      reminder_key in (
        'morning',
        'daily',
        'night',
        'sleep_boundary'
      )
    ),
  label text not null,
  time_local time without time zone not null,
  enabled boolean not null default true,
  timezone text not null default 'America/New_York',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reminder_key)
);

alter table public.daily_reset_reminders
  enable row level security;

drop policy if exists
  "Users can read their reminder settings"
on public.daily_reset_reminders;

create policy
  "Users can read their reminder settings"
on public.daily_reset_reminders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists
  "Users can insert their reminder settings"
on public.daily_reset_reminders;

create policy
  "Users can insert their reminder settings"
on public.daily_reset_reminders
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists
  "Users can update their reminder settings"
on public.daily_reset_reminders;

create policy
  "Users can update their reminder settings"
on public.daily_reset_reminders
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Users can delete their reminder settings"
on public.daily_reset_reminders;

create policy
  "Users can delete their reminder settings"
on public.daily_reset_reminders
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_daily_reset_reminder()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists
  touch_daily_reset_reminder_updated_at
on public.daily_reset_reminders;

create trigger
  touch_daily_reset_reminder_updated_at
before update
on public.daily_reset_reminders
for each row
execute function public.touch_daily_reset_reminder();

create or replace function public.seed_default_reminders(
  target_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if auth.uid() <> target_user_id then
    raise exception
      'Reminder settings can only be seeded for the authenticated user.';
  end if;

  insert into public.daily_reset_reminders (
    user_id,
    reminder_key,
    label,
    time_local,
    enabled,
    timezone,
    sort_order
  )
  values
    (
      target_user_id,
      'morning',
      'Morning Reset',
      '08:30',
      true,
      'America/New_York',
      10
    ),
    (
      target_user_id,
      'daily',
      'Daily Protocols',
      '14:00',
      true,
      'America/New_York',
      20
    ),
    (
      target_user_id,
      'night',
      'Shutdown Protocol',
      '21:30',
      true,
      'America/New_York',
      30
    ),
    (
      target_user_id,
      'sleep_boundary',
      'Sleep Boundary',
      '23:00',
      true,
      'America/New_York',
      40
    )
  on conflict (user_id, reminder_key)
  do nothing;
end;
$$;

grant execute on function public.seed_default_reminders(
  uuid
) to authenticated;

create or replace function public.save_daily_reset_reminders(
  target_reminders jsonb,
  target_timezone text
)
returns setof public.daily_reset_reminders
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  reminder_item jsonb;
  selected_key text;
  selected_time time without time zone;
  selected_enabled boolean;
  selected_label text;
  selected_sort_order integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if jsonb_typeof(target_reminders) <> 'array' then
    raise exception
      'Reminder settings must be supplied as an array.';
  end if;

  if nullif(trim(target_timezone), '') is null then
    raise exception 'A valid timezone is required.';
  end if;

  for reminder_item in
    select value
    from jsonb_array_elements(target_reminders)
  loop
    selected_key :=
      reminder_item ->> 'reminder_key';

    if selected_key not in (
      'morning',
      'daily',
      'night',
      'sleep_boundary'
    ) then
      raise exception
        'Unsupported reminder key: %',
        selected_key;
    end if;

    begin
      selected_time :=
        (reminder_item ->> 'time_local')::time;
    exception
      when others then
        raise exception
          'Invalid time for reminder %.',
          selected_key;
    end;

    selected_enabled :=
      coalesce(
        (reminder_item ->> 'enabled')::boolean,
        false
      );

    selected_label :=
      case selected_key
        when 'morning' then 'Morning Reset'
        when 'daily' then 'Daily Protocols'
        when 'night' then 'Shutdown Protocol'
        when 'sleep_boundary' then 'Sleep Boundary'
      end;

    selected_sort_order :=
      case selected_key
        when 'morning' then 10
        when 'daily' then 20
        when 'night' then 30
        when 'sleep_boundary' then 40
      end;

    insert into public.daily_reset_reminders (
      user_id,
      reminder_key,
      label,
      time_local,
      enabled,
      timezone,
      sort_order
    )
    values (
      current_user_id,
      selected_key,
      selected_label,
      selected_time,
      selected_enabled,
      target_timezone,
      selected_sort_order
    )
    on conflict (user_id, reminder_key)
    do update set
      label = excluded.label,
      time_local = excluded.time_local,
      enabled = excluded.enabled,
      timezone = excluded.timezone,
      sort_order = excluded.sort_order;
  end loop;

  return query
  select reminder.*
  from public.daily_reset_reminders reminder
  where reminder.user_id = current_user_id
  order by reminder.sort_order asc;
end;
$$;

grant execute on function public.save_daily_reset_reminders(
  jsonb,
  text
) to authenticated;
