-- 1. CREATE SESSIONS LOBBY TABLE
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  created_by uuid references auth.users(id) default auth.uid(),
  status text default 'active', -- 'active' or 'completed'
  created_at timestamp with time zone default now()
);

-- 2. UPGRADE FABRICS TABLE
alter table fabrics 
  add column if not exists created_by uuid references auth.users(id) default auth.uid(),
  add column if not exists tagged_by uuid references auth.users(id),
  add column if not exists created_by_email text,
  add column if not exists tagged_by_email text,
  add column if not exists session_id uuid references sessions(id) on delete cascade;

-- 3. RESET RLS POLICIES FOR SESSIONS
alter table sessions enable row level security;

drop policy if exists "Allow authenticated users to manage sessions" on sessions;

create policy "Allow authenticated users to manage sessions"
  on sessions for all
  to authenticated
  using (true)
  with check (true);

-- 4. RESET RLS POLICIES FOR FABRICS
alter table fabrics enable row level security;

drop policy if exists "Allow all public operations for fabrics" on fabrics;
drop policy if exists "Allow authenticated users to read fabrics" on fabrics;
drop policy if exists "Allow authenticated users to insert fabrics" on fabrics;
drop policy if exists "Allow authenticated users to update fabrics" on fabrics;

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

-- 5. RESET STORAGE POLICIES FOR FABRIC-IMAGES BUCKET
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
