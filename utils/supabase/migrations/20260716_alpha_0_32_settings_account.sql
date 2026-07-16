-- Alpha 0.32 — Settings + Account Controls
-- Adds cloud-synced Daily Reset preferences with per-user RLS.

create table if not exists public.daily_reset_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  protein_target integer not null default 150
    check (protein_target between 1 and 500),
  weight_unit text not null default 'lbs'
    check (weight_unit in ('lbs', 'kg')),
  timezone text not null default 'America/New_York',
  display_density text not null default 'comfortable'
    check (display_density in ('comfortable', 'compact')),
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_reset_settings
  enable row level security;

drop policy if exists
  "Users can read their reset settings"
on public.daily_reset_settings;

create policy
  "Users can read their reset settings"
on public.daily_reset_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists
  "Users can insert their reset settings"
on public.daily_reset_settings;

create policy
  "Users can insert their reset settings"
on public.daily_reset_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists
  "Users can update their reset settings"
on public.daily_reset_settings;

create policy
  "Users can update their reset settings"
on public.daily_reset_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Users can delete their reset settings"
on public.daily_reset_settings;

create policy
  "Users can delete their reset settings"
on public.daily_reset_settings
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_daily_reset_settings()
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
  touch_daily_reset_settings_updated_at
on public.daily_reset_settings;

create trigger
  touch_daily_reset_settings_updated_at
before update
on public.daily_reset_settings
for each row
execute function public.touch_daily_reset_settings();

create or replace function public.seed_default_reset_settings(
  target_user_id uuid,
  target_protein_target integer default 150
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
      'Settings can only be seeded for the authenticated user.';
  end if;

  insert into public.daily_reset_settings (
    user_id,
    protein_target,
    weight_unit,
    timezone,
    display_density,
    reduced_motion
  )
  values (
    target_user_id,
    greatest(
      1,
      least(
        500,
        coalesce(target_protein_target, 150)
      )
    ),
    'lbs',
    'America/New_York',
    'comfortable',
    false
  )
  on conflict (user_id)
  do nothing;
end;
$$;

grant execute on function public.seed_default_reset_settings(
  uuid,
  integer
) to authenticated;

create or replace function public.save_daily_reset_settings(
  target_protein_target integer,
  target_weight_unit text,
  target_timezone text,
  target_display_density text,
  target_reduced_motion boolean
)
returns table (
  setting_user_id uuid,
  setting_protein_target integer,
  setting_weight_unit text,
  setting_timezone text,
  setting_display_density text,
  setting_reduced_motion boolean,
  setting_updated_at timestamptz
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

  if target_protein_target < 1
    or target_protein_target > 500 then
    raise exception
      'Protein target must be between 1 and 500 grams.';
  end if;

  if target_weight_unit not in ('lbs', 'kg') then
    raise exception
      'Weight unit must be lbs or kg.';
  end if;

  if nullif(trim(target_timezone), '') is null then
    raise exception 'Timezone is required.';
  end if;

  if target_display_density not in (
    'comfortable',
    'compact'
  ) then
    raise exception
      'Display density must be comfortable or compact.';
  end if;

  insert into public.daily_reset_settings (
    user_id,
    protein_target,
    weight_unit,
    timezone,
    display_density,
    reduced_motion
  )
  values (
    current_user_id,
    target_protein_target,
    target_weight_unit,
    trim(target_timezone),
    target_display_density,
    target_reduced_motion
  )
  on conflict (user_id)
  do update set
    protein_target = excluded.protein_target,
    weight_unit = excluded.weight_unit,
    timezone = excluded.timezone,
    display_density = excluded.display_density,
    reduced_motion = excluded.reduced_motion;

  -- Keep reminder calculations aligned with the saved app timezone.
  update public.daily_reset_reminders
  set timezone = trim(target_timezone)
  where user_id = current_user_id;

  return query
  select
    settings.user_id,
    settings.protein_target,
    settings.weight_unit,
    settings.timezone,
    settings.display_density,
    settings.reduced_motion,
    settings.updated_at
  from public.daily_reset_settings settings
  where settings.user_id = current_user_id;
end;
$$;

grant execute on function public.save_daily_reset_settings(
  integer,
  text,
  text,
  text,
  boolean
) to authenticated;
