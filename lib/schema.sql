-- 1. CREATE TEAMS & MEMBERS
create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

create table if not exists team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  primary key (team_id, user_id)
);

-- 2. CREATE SESSIONS LOBBY TABLE
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  team_id uuid references teams(id) on delete cascade,
  created_by uuid references auth.users(id) default auth.uid(),
  status text default 'active', -- 'active' or 'completed'
  created_at timestamp with time zone default now()
);

-- 3. CREATE LOBBY CONNECTIONS (PRESENCE TRACKING)
create table if not exists session_connections (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  role text not null, -- 'photographer', 'tagger'
  last_seen_at timestamp with time zone default now(),
  unique (session_id, user_id)
);

-- 4. UPGRADE TABLES
alter table sessions
  add column if not exists team_id uuid references teams(id) on delete cascade;

alter table fabrics 
  add column if not exists created_by uuid references auth.users(id) default auth.uid(),
  add column if not exists tagged_by uuid references auth.users(id),
  add column if not exists created_by_email text,
  add column if not exists tagged_by_email text,
  add column if not exists session_id uuid references sessions(id) on delete cascade;

-- 5. ENABLE RLS & DEFINE POLICIES
alter table teams enable row level security;
alter table team_members enable row level security;
alter table sessions enable row level security;
alter table fabrics enable row level security;
alter table session_connections enable row level security;

-- Drop existing policies to prevent conflicts
drop policy if exists "Allow authenticated users to manage teams" on teams;
drop policy if exists "Allow authenticated users to manage team_members" on team_members;
drop policy if exists "Allow authenticated users to manage sessions" on sessions;
drop policy if exists "Allow authenticated users to manage session_connections" on session_connections;
drop policy if exists "Allow all public operations for fabrics" on fabrics;
drop policy if exists "Allow authenticated users to read fabrics" on fabrics;
drop policy if exists "Allow authenticated users to insert fabrics" on fabrics;
drop policy if exists "Allow authenticated users to update fabrics" on fabrics;

-- Create secure policies
create policy "Allow authenticated users to manage teams" on teams for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage team_members" on team_members for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage sessions"
  on sessions for all
  to authenticated
  using (
    exists (
      select 1 from team_members
      where team_members.team_id = sessions.team_id
        and team_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from team_members
      where team_members.team_id = sessions.team_id
        and team_members.user_id = auth.uid()
    )
  );
create policy "Allow authenticated users to manage session_connections" on session_connections for all to authenticated using (true) with check (true);

create policy "Allow authenticated users to read fabrics"
  on fabrics for select
  to authenticated
  using (true);

create policy "Allow authenticated users to insert fabrics"
  on fabrics for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Allow authenticated users to update fabrics"
  on fabrics for update
  to authenticated
  using (true)
  with check (true);

-- 6. RESET STORAGE POLICIES FOR FABRIC-IMAGES BUCKET
insert into storage.buckets (id, name, public)
values ('fabric-images', 'fabric-images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public uploads onto fabric-images" on storage.objects;
drop policy if exists "Allow public read access of fabric-images" on storage.objects;
drop policy if exists "Allow authenticated users to upload fabric images" on storage.objects;
drop policy if exists "Allow authenticated users to read fabric images" on storage.objects;

create policy "Allow authenticated users to upload fabric images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fabric-images');

create policy "Allow authenticated users to read fabric images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fabric-images');
