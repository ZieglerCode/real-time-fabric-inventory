-- 1. UPGRADE FABRICS TABLE
alter table fabrics 
  add column if not exists created_by uuid references auth.users(id) default auth.uid(),
  add column if not exists tagged_by uuid references auth.users(id),
  add column if not exists created_by_email text,
  add column if not exists tagged_by_email text;

-- 2. RESET RLS POLICIES FOR FABRICS
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

-- 3. RESET STORAGE POLICIES FOR FABRIC-IMAGES BUCKET
-- Ensure the storage bucket exists
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
