-- Alpha 0.33 — Closed-App Web Push Notifications
-- Stores per-device push subscriptions and one delivery record per reminder/day.

create table if not exists public.daily_reset_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  expiration_time timestamptz,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  daily_reset_push_subscriptions_user_enabled_idx
on public.daily_reset_push_subscriptions (
  user_id,
  enabled
);

alter table public.daily_reset_push_subscriptions
  enable row level security;

drop policy if exists
  "Users can read their push subscriptions"
on public.daily_reset_push_subscriptions;

create policy
  "Users can read their push subscriptions"
on public.daily_reset_push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists
  "Users can insert their push subscriptions"
on public.daily_reset_push_subscriptions;

create policy
  "Users can insert their push subscriptions"
on public.daily_reset_push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists
  "Users can update their push subscriptions"
on public.daily_reset_push_subscriptions;

create policy
  "Users can update their push subscriptions"
on public.daily_reset_push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Users can delete their push subscriptions"
on public.daily_reset_push_subscriptions;

create policy
  "Users can delete their push subscriptions"
on public.daily_reset_push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_daily_reset_push_subscription()
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
  touch_daily_reset_push_subscription_updated_at
on public.daily_reset_push_subscriptions;

create trigger
  touch_daily_reset_push_subscription_updated_at
before update
on public.daily_reset_push_subscriptions
for each row
execute function public.touch_daily_reset_push_subscription();

create table if not exists public.daily_reset_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.daily_reset_push_subscriptions(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  reminder_key text not null
    check (
      reminder_key in (
        'morning',
        'daily',
        'night',
        'sleep_boundary'
      )
    ),
  local_date date not null,
  status text not null default 'processing'
    check (
      status in (
        'processing',
        'sent',
        'failed'
      )
    ),
  attempt_count integer not null default 1
    check (attempt_count > 0),
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    subscription_id,
    reminder_key,
    local_date
  )
);

create index if not exists
  daily_reset_push_deliveries_user_date_idx
on public.daily_reset_push_deliveries (
  user_id,
  local_date desc
);

alter table public.daily_reset_push_deliveries
  enable row level security;

drop policy if exists
  "Users can read their push deliveries"
on public.daily_reset_push_deliveries;

create policy
  "Users can read their push deliveries"
on public.daily_reset_push_deliveries
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_daily_reset_push_delivery()
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
  touch_daily_reset_push_delivery_updated_at
on public.daily_reset_push_deliveries;

create trigger
  touch_daily_reset_push_delivery_updated_at
before update
on public.daily_reset_push_deliveries
for each row
execute function public.touch_daily_reset_push_delivery();

grant
  select,
  insert,
  update,
  delete
on public.daily_reset_push_subscriptions
to authenticated;

grant select
on public.daily_reset_push_deliveries
to authenticated;

grant all
on public.daily_reset_push_subscriptions
to service_role;

grant all
on public.daily_reset_push_deliveries
to service_role;
