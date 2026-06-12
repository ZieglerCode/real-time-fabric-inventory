-- CREATE WEBHOOKS TABLE
create table if not exists webhooks (
  id uuid default gen_random_uuid() primary key,
  target_url text not null,
  secret_token text,
  active boolean default true,
  events text[] not null, -- e.g. ['fabric.completed', 'fabric.discarded']
  created_at timestamp with time zone default now()
);

-- ENABLE RLS & DEFINE POLICIES
alter table webhooks enable row level security;

drop policy if exists "Allow authenticated users to manage webhooks" on webhooks;
create policy "Allow authenticated users to manage webhooks" 
  on webhooks for all 
  to authenticated 
  using (true) 
  with check (true);
