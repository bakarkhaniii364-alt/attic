-- ============================================================
-- ATTIC AUTH SCHEMA — Run this in Supabase SQL Editor
-- ============================================================
-- IMPORTANT: Also go to Authentication > Settings and
-- disable "Enable email confirmations" for smooth onboarding.
-- ============================================================

-- Rooms table: links two users (a couple)
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  invite_code text unique not null,
  creator_id uuid references auth.users(id) not null,
  partner_id uuid references auth.users(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Ensure the is_active column exists even if the table was created previously
alter table rooms add column if not exists is_active boolean default true;

-- App state table: stores the synchronized data for a room
create table if not exists app_state (
  room_id text primary key,
  state jsonb default '{}'::jsonb,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security
alter table rooms enable row level security;
alter table app_state enable row level security;

-- Policy: users can read rooms they belong to
drop policy if exists "read_own_rooms" on rooms;
create policy "read_own_rooms" on rooms
  for select using (creator_id = auth.uid() or partner_id = auth.uid());

-- Policy: users can create rooms as creator
drop policy if exists "create_rooms" on rooms;
create policy "create_rooms" on rooms
  for insert with check (creator_id = auth.uid());

-- Policy: users can access app_state for their rooms
drop policy if exists "access_app_state" on app_state;
create policy "access_app_state" on app_state
  for all using (
    room_id in (
      select id::text from rooms 
      where (creator_id = auth.uid() or partner_id = auth.uid()) and is_active = true
    )
  );

-- ── Claim an invite code (partner joining) ──
create or replace function claim_invite(code text)
returns json as $$
declare
  room_row rooms%rowtype;
begin
  select * into room_row from rooms where invite_code = upper(code) and is_active = true;

  if not found then
    return json_build_object('error', 'invalid_code', 'message', 'that code doesn''t exist. double-check and try again.');
  end if;

  if room_row.creator_id = auth.uid() then
    return json_build_object('error', 'own_room', 'message', 'you can''t pair with yourself, silly.');
  end if;

  if room_row.partner_id is not null then
    return json_build_object('error', 'already_paired', 'message', 'this attic is already occupied by two.');
  end if;

  -- If joining succeeds, delete any existing unpaired rooms this user created as an orphan
  delete from rooms where creator_id = auth.uid() and partner_id is null;

  update rooms set partner_id = auth.uid() where id = room_row.id;

  return json_build_object('success', true, 'room_id', room_row.id);
end;
$$ language plpgsql security definer;

-- ── Get the current user's room ──
create or replace function get_my_room()
returns json as $$
declare
  room_row rooms%rowtype;
begin
  -- Prioritize rooms where the user is already paired
  select * into room_row from rooms
  where (creator_id = auth.uid() or partner_id = auth.uid()) and is_active = true
  order by (partner_id is not null) desc, created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', room_row.id,
    'invite_code', room_row.invite_code,
    'creator_id', room_row.creator_id,
    'partner_id', room_row.partner_id,
    'is_paired', room_row.partner_id is not null
  );
end;
$$ language plpgsql security definer;

-- ── Unpair the current user and refresh the room invite code ──
create or replace function leave_room(room_uuid uuid)
returns json as $$
declare
  room_row rooms%rowtype;
  new_code text;
begin
  select * into room_row from rooms where id = room_uuid;
  if not found then
    return json_build_object('error', 'not_found', 'message', 'room not found');
  end if;

  if room_row.creator_id <> auth.uid() and room_row.partner_id <> auth.uid() then
    return json_build_object('error', 'not_allowed', 'message', 'you are not part of this room');
  end if;

  if room_row.partner_id is null then
    return json_build_object('error', 'not_paired', 'message', 'this room is already unpaired');
  end if;

  new_code := upper(substring(md5(random()::text) from 1 for 6));
  while exists(select 1 from rooms where invite_code = new_code) loop
    new_code := upper(substring(md5(random()::text) from 1 for 6));
  end loop;

  -- Save away: Deactivate the room instead of clearing it
  update rooms set is_active = false where id = room_uuid;

  return json_build_object('success', true, 'room_id', room_uuid, 'invite_code', new_code);
end;
$$ language plpgsql security definer;

-- ── Delete all data associated with the current user ──
create or replace function delete_user_data()
returns json as $$
declare
  uid uuid := auth.uid();
begin
  -- Delete from app_state for any rooms where user was involved
  delete from app_state where room_id in (
    select id::text from rooms where creator_id = uid or partner_id = uid
  );
  
  -- Delete the rooms themselves
  delete from rooms where creator_id = uid or partner_id = uid;
  
  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

