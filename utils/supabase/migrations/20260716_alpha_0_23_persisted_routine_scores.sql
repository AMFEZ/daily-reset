-- Alpha 0.23 — Persisted Routine Scores
-- Adds cloud-persisted Morning, Daily, Night, and Sleep Boundary scores.
-- Each checklist toggle is serialized, saved, and recalculated in one database transaction.

alter table public.daily_reset_scores
  add column if not exists morning_score integer not null default 0
    check (morning_score between 0 and 100),
  add column if not exists daily_score integer not null default 0
    check (daily_score between 0 and 100),
  add column if not exists night_score integer not null default 0
    check (night_score between 0 and 100),
  add column if not exists trust_score integer not null default 0
    check (trust_score between 0 and 100);

-- Backfill any existing saved reset days from their habit logs.
with calculated as (
  select
    drs.id,
    coalesce(
      round(
        100.0
        * count(*) filter (
            where h.routine_type = 'morning'
              and coalesce(hl.completed, false)
          )
        / nullif(
            count(*) filter (
              where h.routine_type = 'morning'
            ),
            0
          )
      ),
      0
    )::integer as morning_score,
    coalesce(
      round(
        100.0
        * count(*) filter (
            where h.routine_type = 'daily'
              and coalesce(hl.completed, false)
          )
        / nullif(
            count(*) filter (
              where h.routine_type = 'daily'
            ),
            0
          )
      ),
      0
    )::integer as daily_score,
    coalesce(
      round(
        100.0
        * count(*) filter (
            where h.routine_type = 'night'
              and coalesce(hl.completed, false)
          )
        / nullif(
            count(*) filter (
              where h.routine_type = 'night'
            ),
            0
          )
      ),
      0
    )::integer as night_score,
    coalesce(
      round(
        100.0
        * count(*) filter (
            where h.routine_type = 'trust_based'
              and coalesce(hl.completed, false)
          )
        / nullif(
            count(*) filter (
              where h.routine_type = 'trust_based'
            ),
            0
          )
      ),
      0
    )::integer as trust_score
  from public.daily_reset_scores drs
  join public.habits h
    on h.user_id = drs.user_id
   and h.is_active = true
  left join public.habit_logs hl
    on hl.habit_id = h.id
   and hl.date = drs.date
  group by drs.id
)
update public.daily_reset_scores drs
set
  morning_score = calculated.morning_score,
  daily_score = calculated.daily_score,
  night_score = calculated.night_score,
  trust_score = calculated.trust_score
from calculated
where drs.id = calculated.id;

create or replace function public.toggle_habit_and_save_reset_v2(
  target_habit_id uuid,
  target_date date,
  target_completed boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();

  morning_total integer := 0;
  morning_complete integer := 0;
  daily_total integer := 0;
  daily_complete integer := 0;
  night_total integer := 0;
  night_complete integer := 0;
  trust_total integer := 0;
  trust_complete integer := 0;

  calculated_morning integer := 0;
  calculated_daily integer := 0;
  calculated_night integer := 0;
  calculated_trust integer := 0;
  calculated_reset integer := 0;

  calculated_completed integer := 0;
  calculated_total integer := 0;

  calculated_system_status text := 'RECOVERY DAY';
  calculated_consistency_signal text := 'SIGNAL LOW';
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_date is null then
    raise exception 'A reset date is required.';
  end if;

  if not exists (
    select 1
    from public.habits h
    where h.id = target_habit_id
      and h.user_id = current_user_id
  ) then
    raise exception 'Habit not found for the authenticated user.';
  end if;

  -- Serialize rapid checklist changes for this user/date so an older request
  -- cannot overwrite a newer score snapshot.
  perform pg_advisory_xact_lock(
    hashtextextended(
      current_user_id::text || ':' || target_date::text,
      0
    )
  );

  -- Reuse the existing working habit-log RPC.
  perform public.toggle_habit_log(
    target_habit_id,
    target_date,
    target_completed
  );

  select
    count(*) filter (
      where h.routine_type = 'morning'
    )::integer,
    count(*) filter (
      where h.routine_type = 'morning'
        and coalesce(hl.completed, false)
    )::integer,
    count(*) filter (
      where h.routine_type = 'daily'
    )::integer,
    count(*) filter (
      where h.routine_type = 'daily'
        and coalesce(hl.completed, false)
    )::integer,
    count(*) filter (
      where h.routine_type = 'night'
    )::integer,
    count(*) filter (
      where h.routine_type = 'night'
        and coalesce(hl.completed, false)
    )::integer,
    count(*) filter (
      where h.routine_type = 'trust_based'
    )::integer,
    count(*) filter (
      where h.routine_type = 'trust_based'
        and coalesce(hl.completed, false)
    )::integer,
    count(*)::integer,
    count(*) filter (
      where coalesce(hl.completed, false)
    )::integer
  into
    morning_total,
    morning_complete,
    daily_total,
    daily_complete,
    night_total,
    night_complete,
    trust_total,
    trust_complete,
    calculated_total,
    calculated_completed
  from public.habits h
  left join public.habit_logs hl
    on hl.habit_id = h.id
   and hl.date = target_date
  where h.user_id = current_user_id
    and h.is_active = true;

  calculated_morning :=
    case
      when morning_total > 0
        then round(100.0 * morning_complete / morning_total)::integer
      else 0
    end;

  calculated_daily :=
    case
      when daily_total > 0
        then round(100.0 * daily_complete / daily_total)::integer
      else 0
    end;

  calculated_night :=
    case
      when night_total > 0
        then round(100.0 * night_complete / night_total)::integer
      else 0
    end;

  calculated_trust :=
    case
      when trust_total > 0
        then round(100.0 * trust_complete / trust_total)::integer
      else 0
    end;

  calculated_reset := round(
    calculated_morning * 0.35
    + calculated_daily * 0.25
    + calculated_night * 0.25
    + calculated_trust * 0.15
  )::integer;

  calculated_system_status :=
    case
      when calculated_reset >= 80 then 'FULL RESET'
      when calculated_reset >= 50 then 'SOLID DAY'
      when calculated_reset >= 25 then 'MINIMUM WIN'
      else 'RECOVERY DAY'
    end;

  calculated_consistency_signal :=
    case
      when calculated_reset >= 80 then 'SIGNAL LOCKED'
      when calculated_reset >= 50 then 'SIGNAL STABLE'
      when calculated_reset >= 25 then 'SIGNAL BUILDING'
      else 'SIGNAL LOW'
    end;

  insert into public.daily_reset_scores (
    user_id,
    date,
    morning_score,
    daily_score,
    night_score,
    trust_score,
    reset_score,
    completed_protocols,
    total_protocols,
    system_status,
    consistency_signal
  )
  values (
    current_user_id,
    target_date,
    calculated_morning,
    calculated_daily,
    calculated_night,
    calculated_trust,
    calculated_reset,
    calculated_completed,
    calculated_total,
    calculated_system_status,
    calculated_consistency_signal
  )
  on conflict (user_id, date)
  do update set
    morning_score = excluded.morning_score,
    daily_score = excluded.daily_score,
    night_score = excluded.night_score,
    trust_score = excluded.trust_score,
    reset_score = excluded.reset_score,
    completed_protocols = excluded.completed_protocols,
    total_protocols = excluded.total_protocols,
    system_status = excluded.system_status,
    consistency_signal = excluded.consistency_signal;
end;
$$;

grant execute on function public.toggle_habit_and_save_reset_v2(
  uuid,
  date,
  boolean
) to authenticated;