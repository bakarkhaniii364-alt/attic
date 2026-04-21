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
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table rooms enable row level security;

-- Policy: users can read rooms they belong to
create policy "read_own_rooms" on rooms
  for select using (creator_id = auth.uid() or partner_id = auth.uid());

-- Policy: users can create rooms as creator
create policy "create_rooms" on rooms
  for insert with check (creator_id = auth.uid());

-- ── Claim an invite code (partner joining) ──
create or replace function claim_invite(code text)
returns json as $$
declare
  room_row rooms%rowtype;
begin
  select * into room_row from rooms where invite_code = upper(code);

  if not found then
    return json_build_object('error', 'invalid_code', 'message', 'that code doesn''t exist. double-check and try again.');
  end if;

  if room_row.creator_id = auth.uid() then
    return json_build_object('error', 'own_room', 'message', 'you can''t pair with yourself, silly.');
  end if;

  if room_row.partner_id is not null then
    return json_build_object('error', 'already_paired', 'message', 'this attic is already occupied by two.');
  end if;

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
  select * into room_row from rooms
  where creator_id = auth.uid() or partner_id = auth.uid()
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
