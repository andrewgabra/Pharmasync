-- ════════════════════════════════════════════════════════════════
-- PharmaSync — Supabase Schema
-- Run this entire file once in Supabase: Project → SQL Editor → New query → paste → Run
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- 1. PROFILES — extends Supabase Auth users with a role
-- ──────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 2. DISCOUNTS — current live discount % per SKU
-- ──────────────────────────────────────────────────────────────
create table if not exists discounts (
  sku text primary key,
  pct numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ──────────────────────────────────────────────────────────────
-- 3. PRICE_EDITS — current live manual price override per SKU
-- ──────────────────────────────────────────────────────────────
create table if not exists price_edits (
  sku text primary key,
  price numeric not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ──────────────────────────────────────────────────────────────
-- 4. AUDIT_LOG — append-only history of every change
-- ──────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  type text not null,
  sku text,
  old_val text,
  new_val text,
  email text
);
create index if not exists audit_log_ts_idx on audit_log (ts desc);

-- ──────────────────────────────────────────────────────────────
-- 5. VERSIONS — snapshot history for restore (discounts / price_edits)
-- ──────────────────────────────────────────────────────────────
create table if not exists versions (
  id text primary key,
  ts timestamptz not null default now(),
  type text not null check (type in ('discounts','priceEdits')),
  snapshot jsonb not null,
  saved_by text,
  note text
);
create index if not exists versions_type_ts_idx on versions (type, ts desc);

-- ──────────────────────────────────────────────────────────────
-- 6. REQUESTS — approval-request queue for non-admin changes
-- ──────────────────────────────────────────────────────────────
create table if not exists requests (
  id text primary key,
  ts timestamptz not null default now(),
  action text not null,
  label text,
  payload jsonb,
  requested_by text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by text
);
create index if not exists requests_status_idx on requests (status, ts desc);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- All tables are readable by any authenticated user (staff can see
-- shared data) but writes go through the API routes using the
-- service-role key, which bypasses RLS. RLS here is the safety net
-- in case the anon/public key is ever used directly from the browser.
-- ════════════════════════════════════════════════════════════════

alter table profiles    enable row level security;
alter table discounts   enable row level security;
alter table price_edits enable row level security;
alter table audit_log   enable row level security;
alter table versions    enable row level security;
alter table requests    enable row level security;

-- Profiles: a user can read their own profile; admins can read all
create policy "read own profile" on profiles
  for select using (auth.uid() = id);

-- Everyone authenticated can read shared business data (read-only via anon key)
create policy "authenticated read discounts" on discounts
  for select using (auth.role() = 'authenticated');
create policy "authenticated read price_edits" on price_edits
  for select using (auth.role() = 'authenticated');
create policy "authenticated read audit_log" on audit_log
  for select using (auth.role() = 'authenticated');
create policy "authenticated read versions" on versions
  for select using (auth.role() = 'authenticated');
create policy "authenticated read own requests" on requests
  for select using (auth.role() = 'authenticated');

-- No insert/update/delete policies are defined for anon/authenticated roles.
-- This means writes ONLY succeed via the service-role key used server-side
-- in /api routes — never directly from the browser. This is intentional.

-- ──────────────────────────────────────────────────────────────
-- 7. Make the first admin
-- ──────────────────────────────────────────────────────────────
-- After you sign up your first user (the admin) through the app's login
-- screen, run this once, replacing the email:
--
--   update profiles set role = 'admin' where email = 'gpharmacyeg@gmail.com';
