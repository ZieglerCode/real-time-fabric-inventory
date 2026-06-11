# Coolify Deployment: Real-time Fabric Inventory

This document explains how to deploy this application to your VPS using Coolify and configure the required Supabase backend.

## 1. Coolify Configuration

Create a new resource in Coolify pointing to this Git repository:

- **Build Pack**: `Dockerfile`
- **Destination Port**: `3000`
- **Domain**: For example, `https://fabric-inventory.apps.mathishoffmann.com` (or your custom domain)

### Environment Variables

Configure the following environment variables in the Coolify App Dashboard.

> [!IMPORTANT]
> **Build-Time Variables**: Next.js requires `NEXT_PUBLIC_` variables to be present during compilation (build-time). In Coolify, make sure to check the **Build Variable** (or "Build-Time") option for these.

| Variable Name | Type | Description |
|---|---|---|
| `NODE_ENV` | Runtime | Set to `production`. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Build-Time** & Runtime | The API URL of your Supabase project (e.g., `https://xxxx.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build-Time** & Runtime | The anonymous public API key of your Supabase project. |
| `APP_URL` | Runtime | The URL where the application is hosted (e.g., `https://fabric-inventory.apps.mathishoffmann.com`). |

---

## 2. Supabase Database Setup

Open the SQL Editor in your Supabase project dashboard and run the following script. This initializes the required database schema, realtime subscriptions, and public storage bucket.

```sql
-- 1. CREATE FABRICS TABLE
create table if not exists fabrics (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  name text,
  qr_code_id text,
  status text default 'pending', -- 'pending', 'completed', or 'discarded'
  rejection_reason text,
  discarded_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 2. ENABLE REALTIME REPLICATION FOR THE FABRICS TABLE
alter publication supabase_realtime add table fabrics;

-- 3. ENABLE ROW LEVEL SECURITY & PERMIT PUBLIC ACCESS FOR SPEEDY SETUP
alter table fabrics enable row level security;

create policy "Allow all public operations for fabrics"
  on fabrics for all
  using (true)
  with check (true);

-- 4. INSERT STORAGE BUCKETS AND CONFIGURE POLICIES
insert into storage.buckets (id, name, public)
values ('fabric-images', 'fabric-images', true)
on conflict (id) do nothing;

create policy "Allow public uploads onto fabric-images"
  on storage.objects for insert
  with check (bucket_id = 'fabric-images');

create policy "Allow public read access of fabric-images"
  on storage.objects for select
  using (bucket_id = 'fabric-images');
```

---

## 3. Deploy

Once the environment variables and the Supabase setup are ready:
1. Click **Deploy** in Coolify.
2. Watch the logs to ensure the Next.js standalone build finishes successfully and starts up.
3. Open the app URL and verify that the Supabase status indicator in the top-right shows **"Supabase Connection Active"**.
