-- Alpha 0.31 — Protocol Manager
-- Adds authenticated RPCs to create, edit, reorder, disable, and restore
-- Daily Reset protocols without deleting historical habit logs.

create or replace function public.create_daily_reset_protocol(
  target_name text,
  target_category text,
  target_routine_type text
)
returns table (
  protocol_id uuid,
  protocol_name text,
  protocol_category text,
  protocol_section text,
  protocol_routine_type text,
  protocol_sort_order integer,
  protocol_is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_name text := nullif(trim(target_name), '');
  cleaned_category text :=
    coalesce(nullif(trim(target_category), ''), 'Custom');
  selected_section text;
  next_sort_order integer;
  created_habit public.habits%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if cleaned_name is null then
    raise exception 'Protocol name is required.';
  end if;

  if char_length(cleaned_name) > 120 then
    raise exception
      'Protocol name must be 120 characters or fewer.';
  end if;

  if target_routine_type not in (
    'morning',
    'daily',
    'night',
    'trust_based'
  ) then
    raise exception
      'Unsupported routine type: %',
      target_routine_type;
  end if;

  selected_section :=
    case target_routine_type
      when 'morning' then 'Morning Reset'
      when 'daily' then 'Daily Protocols'
      when 'night' then 'Shutdown Protocol'
      when 'trust_based' then 'Sleep Boundary'
    end;

  select
    coalesce(max(h.sort_order), 0) + 10
  into next_sort_order
  from public.habits h
  where h.user_id = current_user_id
    and h.routine_type = target_routine_type;

  insert into public.habits (
    user_id,
    name,
    category,
    section,
    routine_type,
    sort_order,
    is_active
  )
  values (
    current_user_id,
    cleaned_name,
    cleaned_category,
    selected_section,
    target_routine_type,
    next_sort_order,
    true
  )
  returning *
  into created_habit;

  return query
  select
    created_habit.id,
    created_habit.name,
    created_habit.category,
    created_habit.section,
    created_habit.routine_type,
    created_habit.sort_order,
    created_habit.is_active;
end;
$$;

grant execute on function public.create_daily_reset_protocol(
  text,
  text,
  text
) to authenticated;

create or replace function public.update_daily_reset_protocol(
  target_habit_id uuid,
  target_name text,
  target_category text,
  target_routine_type text,
  target_is_active boolean
)
returns table (
  protocol_id uuid,
  protocol_name text,
  protocol_category text,
  protocol_section text,
  protocol_routine_type text,
  protocol_sort_order integer,
  protocol_is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_name text := nullif(trim(target_name), '');
  cleaned_category text :=
    coalesce(nullif(trim(target_category), ''), 'Custom');
  selected_section text;
  existing_habit public.habits%rowtype;
  selected_sort_order integer;
  updated_habit public.habits%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if cleaned_name is null then
    raise exception 'Protocol name is required.';
  end if;

  if char_length(cleaned_name) > 120 then
    raise exception
      'Protocol name must be 120 characters or fewer.';
  end if;

  if target_routine_type not in (
    'morning',
    'daily',
    'night',
    'trust_based'
  ) then
    raise exception
      'Unsupported routine type: %',
      target_routine_type;
  end if;

  select *
  into existing_habit
  from public.habits h
  where h.id = target_habit_id
    and h.user_id = current_user_id;

  if not found then
    raise exception
      'Protocol not found for the authenticated user.';
  end if;

  selected_section :=
    case target_routine_type
      when 'morning' then 'Morning Reset'
      when 'daily' then 'Daily Protocols'
      when 'night' then 'Shutdown Protocol'
      when 'trust_based' then 'Sleep Boundary'
    end;

  if existing_habit.routine_type =
    target_routine_type then
    selected_sort_order :=
      existing_habit.sort_order;
  else
    select
      coalesce(max(h.sort_order), 0) + 10
    into selected_sort_order
    from public.habits h
    where h.user_id = current_user_id
      and h.routine_type =
        target_routine_type;
  end if;

  update public.habits
  set
    name = cleaned_name,
    category = cleaned_category,
    section = selected_section,
    routine_type = target_routine_type,
    sort_order = selected_sort_order,
    is_active = target_is_active
  where id = target_habit_id
    and user_id = current_user_id
  returning *
  into updated_habit;

  return query
  select
    updated_habit.id,
    updated_habit.name,
    updated_habit.category,
    updated_habit.section,
    updated_habit.routine_type,
    updated_habit.sort_order,
    updated_habit.is_active;
end;
$$;

grant execute on function public.update_daily_reset_protocol(
  uuid,
  text,
  text,
  text,
  boolean
) to authenticated;

create or replace function public.move_daily_reset_protocol(
  target_habit_id uuid,
  target_direction text
)
returns table (
  protocol_id uuid,
  protocol_name text,
  protocol_category text,
  protocol_section text,
  protocol_routine_type text,
  protocol_sort_order integer,
  protocol_is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_habit public.habits%rowtype;
  sibling_habit public.habits%rowtype;
  original_sort_order integer;
  moved_habit public.habits%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_direction not in ('up', 'down') then
    raise exception
      'Direction must be up or down.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      current_user_id::text ||
      ':protocol-order',
      0
    )
  );

  select *
  into current_habit
  from public.habits h
  where h.id = target_habit_id
    and h.user_id = current_user_id;

  if not found then
    raise exception
      'Protocol not found for the authenticated user.';
  end if;

  if not current_habit.is_active then
    raise exception
      'Restore the protocol before reordering it.';
  end if;

  if target_direction = 'up' then
    select *
    into sibling_habit
    from public.habits h
    where h.user_id = current_user_id
      and h.routine_type =
        current_habit.routine_type
      and h.is_active = true
      and (
        h.sort_order <
          current_habit.sort_order
        or (
          h.sort_order =
            current_habit.sort_order
          and h.id < current_habit.id
        )
      )
    order by
      h.sort_order desc,
      h.id desc
    limit 1;
  else
    select *
    into sibling_habit
    from public.habits h
    where h.user_id = current_user_id
      and h.routine_type =
        current_habit.routine_type
      and h.is_active = true
      and (
        h.sort_order >
          current_habit.sort_order
        or (
          h.sort_order =
            current_habit.sort_order
          and h.id > current_habit.id
        )
      )
    order by
      h.sort_order asc,
      h.id asc
    limit 1;
  end if;

  if found then
    original_sort_order :=
      current_habit.sort_order;

    update public.habits
    set sort_order = sibling_habit.sort_order
    where id = current_habit.id
      and user_id = current_user_id;

    update public.habits
    set sort_order = original_sort_order
    where id = sibling_habit.id
      and user_id = current_user_id;
  end if;

  select *
  into moved_habit
  from public.habits h
  where h.id = target_habit_id
    and h.user_id = current_user_id;

  return query
  select
    moved_habit.id,
    moved_habit.name,
    moved_habit.category,
    moved_habit.section,
    moved_habit.routine_type,
    moved_habit.sort_order,
    moved_habit.is_active;
end;
$$;

grant execute on function public.move_daily_reset_protocol(
  uuid,
  text
) to authenticated;
