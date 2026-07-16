-- Alpha 0.24 — Today Snapshot + End-of-Day Lock
-- Adds a reversible cloud lock for a finalized daily reset.
-- Locked days reject habit-log edits from every device until explicitly unlocked.

alter table public.daily_reset_scores
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz;

create or replace function public.set_daily_reset_lock(
  target_date date,
  target_locked boolean
)
returns table (
  lock_date date,
  lock_state boolean,
  lock_timestamp timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_date is null then
    raise exception 'A reset date is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      current_user_id::text || ':' || target_date::text,
      0
    )
  );

  update public.daily_reset_scores
  set
    is_locked = target_locked,
    locked_at = case
      when target_locked then now()
      else null
    end
  where user_id = current_user_id
    and date = target_date;

  if not found then
    raise exception
      'No reset snapshot exists for this date. Complete at least one protocol first.';
  end if;

  return query
  select
    drs.date,
    drs.is_locked,
    drs.locked_at
  from public.daily_reset_scores drs
  where drs.user_id = current_user_id
    and drs.date = target_date;
end;
$$;

grant execute on function public.set_daily_reset_lock(
  date,
  boolean
) to authenticated;

create or replace function public.prevent_locked_habit_log_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_habit_id uuid;
  target_log_date date;
  owner_user_id uuid;
  reset_is_locked boolean := false;
begin
  target_habit_id := case
    when tg_op = 'DELETE' then old.habit_id
    else new.habit_id
  end;

  target_log_date := case
    when tg_op = 'DELETE' then old.date
    else new.date
  end;

  select h.user_id
  into owner_user_id
  from public.habits h
  where h.id = target_habit_id;

  if owner_user_id is null then
    raise exception 'Habit owner could not be resolved.';
  end if;

  if auth.uid() is not null and auth.uid() <> owner_user_id then
    raise exception 'Habit does not belong to the authenticated user.';
  end if;

  select coalesce(drs.is_locked, false)
  into reset_is_locked
  from public.daily_reset_scores drs
  where drs.user_id = owner_user_id
    and drs.date = target_log_date;

  if reset_is_locked then
    raise exception
      'This daily reset is locked. Unlock it before changing protocols.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_habit_log_changes
on public.habit_logs;

create trigger prevent_locked_habit_log_changes
before insert or update or delete
on public.habit_logs
for each row
execute function public.prevent_locked_habit_log_changes();